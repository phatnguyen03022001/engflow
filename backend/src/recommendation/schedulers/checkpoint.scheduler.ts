// @lifecycle ACTIVE — Scheduler for due checkpoint execution

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CheckpointService } from '../services/checkpoint.service';
import { DecisionMemoryService } from '../services/decision-memory.service';

@Injectable()
export class CheckpointScheduler {
  private readonly logger = new Logger(CheckpointScheduler.name);

  constructor(
    private readonly checkpointService: CheckpointService,
    private readonly decisionMemoryService: DecisionMemoryService,
  ) {}

  /**
   * Daily at 02:00 — execute due checkpoints.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async processDueCheckpoints() {
    this.logger.log('Processing due checkpoints...');

    const due = await this.checkpointService.findDueCheckpoints();
    this.logger.log(`Found ${due.length} due checkpoint(s)`);

    for (const checkpoint of due) {
      try {
        // Attempt auto-assessment
        const result = await this.checkpointService.autoAssess(
          checkpoint.recommendationId,
        );

        // Schedule 30-day reminder for manual assessment if auto-assessment
        // returned low confidence
        if (result.confidence === 'LOW') {
          this.logger.warn(
            `Checkpoint ${checkpoint.checkpoint} for ${checkpoint.recommendationId} requires manual assessment`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to process checkpoint ${checkpoint.id}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log('Checkpoint processing complete');
  }

  /**
   * Daily at 03:00 — decay decision memory weights.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async decayMemory() {
    this.logger.log('Running decision memory decay...');
    try {
      await this.decisionMemoryService.decayAll();
      this.logger.log('Decision memory decay complete');
    } catch (error) {
      this.logger.error(
        `Decision memory decay failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
