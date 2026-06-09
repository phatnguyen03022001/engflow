/* @lifecycle ACTIVE — Self-healing auto-retry on execution failure */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MetricService } from './metric.service';

const MAX_RETRIES = 2;

@Injectable()
export class SelfHealService {
  private readonly logger = new Logger(SelfHealService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricService: MetricService,
  ) {}

  /**
   * Retry failed executions related to a drift event.
   * Finds FAILED agent executions whose requestSummary matches the drift's sourcePath
   * and retries them if they haven't exceeded max retries.
   */
  async healDrift(driftEventId: string): Promise<{ retried: number }> {
    const event = await this.prisma.driftEvent.findUnique({
      where: { id: driftEventId },
    });
    if (!event) {
      throw new NotFoundException('Drift event not found');
    }
    if (event.isResolved) return { retried: 0 };

    // Find FAILED executions whose requestSummary contains a segment from sourcePath
    const sourceFragment = event.sourcePath ? event.sourcePath.split('/').pop() : undefined;
    const related = await this.prisma.agentExecution.findMany({
      where: {
        finalOutcome: 'FAILED',
        retryCount: { lt: MAX_RETRIES },
        ...(sourceFragment && {
          requestSummary: { contains: sourceFragment },
        }),
      },
    });

    let retried = 0;
    for (const exec of related) {
      const r = await this.retryFailedExecution(exec.executionId);
      if (r.retried) retried++;
    }
    return { retried };
  }

  /**
   * Retry a single failed execution.
   * Only executions with finalOutcome === 'FAILED' and retryCount < MAX_RETRIES qualify.
   * Increments retryCount and triggers the post-commit hook.
   */
  async retryFailedExecution(executionId: string): Promise<{
    executionId: string;
    retryCount: number;
    retried: boolean;
    reason: string;
  }> {
    const execution = await this.prisma.agentExecution.findUnique({
      where: { executionId },
    });

    if (!execution) {
      throw new NotFoundException(
        `Execution with executionId "${executionId}" not found`,
      );
    }

    if (execution.finalOutcome !== 'FAILED') {
      return {
        executionId,
        retryCount: execution.retryCount,
        retried: false,
        reason: `Execution is ${execution.finalOutcome}, not FAILED`,
      };
    }

    if (execution.retryCount >= MAX_RETRIES) {
      return {
        executionId,
        retryCount: execution.retryCount,
        retried: false,
        reason: `Max retries (${MAX_RETRIES}) reached`,
      };
    }

    // Increment retry count and reset outcome to retry state
    const updated = await this.prisma.agentExecution.update({
      where: { executionId },
      data: {
        retryCount: { increment: 1 },
        finalOutcome: 'RETRYING',
        debugSuccess: null,
        committedAt: null,
      },
    });

    this.logger.log(
      `Retried execution ${executionId} (attempt ${updated.retryCount}/${MAX_RETRIES})`,
    );

    // Fire-and-forget: trigger metric processing
    this.metricService.onExecutionCommitted(executionId).catch((err) => {
      this.logger.warn(
        `Post-retry metric processing failed for ${executionId}: ${(err as Error).message}`,
      );
    });

    return {
      executionId,
      retryCount: updated.retryCount,
      retried: true,
      reason: `Retry attempt ${updated.retryCount}/${MAX_RETRIES}`,
    };
  }

  /**
   * Find all failed executions with retryCount < MAX_RETRIES and retry each.
   * Returns summary of retried and skipped executions.
   */
  async retryAllFailed(): Promise<{
    total: number;
    retried: number;
    skipped: number;
    errors: number;
    results: Array<{
      executionId: string;
      retried: boolean;
      reason: string;
    }>;
  }> {
    const failed = await this.prisma.agentExecution.findMany({
      where: {
        finalOutcome: 'FAILED',
        retryCount: { lt: MAX_RETRIES },
      },
      orderBy: { createdAt: 'asc' },
    });

    this.logger.log(
      `Found ${failed.length} failed executions eligible for retry`,
    );

    const results: Array<{
      executionId: string;
      retried: boolean;
      reason: string;
    }> = [];

    for (const execution of failed) {
      try {
        const result = await this.retryFailedExecution(execution.executionId);
        results.push(result);
      } catch (error) {
        const message = (error as Error).message;
        this.logger.error(
          `Failed to retry execution ${execution.executionId}: ${message}`,
        );
        results.push({
          executionId: execution.executionId,
          retried: false,
          reason: `Error: ${message}`,
        });
      }
    }

    const retried = results.filter((r) => r.retried).length;
    const errors = results.filter((r) => r.reason.startsWith('Error:')).length;
    const skipped = results.length - retried - errors;

    return {
      total: failed.length,
      retried,
      skipped,
      errors,
      results,
    };
  }
}
