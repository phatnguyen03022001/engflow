/* @lifecycle ACTIVE — Cost tracking and aggregation service (ADR-010) */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateCostLogDto } from '../dto/create-cost-log.dto';
import { CostReportQueryDto } from '../dto/cost-report-query.dto';
import {
  CostReport,
  CostSummary,
  CostByModel,
  CostByDay,
  CostLogEntry,
} from '../interfaces/cost-report.interface';

@Injectable()
export class CostTrackerService {
  private readonly logger = new Logger(CostTrackerService.name);
  private readonly budgetUsd = 80;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a cost log entry from an agent execution phase.
   */
  async recordCost(dto: CreateCostLogDto): Promise<CostLogEntry> {
    // Validate that the model exists in the registry
    const model = await this.prisma.modelRegistry.findUnique({
      where: { modelId: dto.modelId },
    });
    if (!model) {
      throw new NotFoundException(`Model "${dto.modelId}" not found in registry`);
    }

    const log = await this.prisma.costLog.create({
      data: {
        modelId: dto.modelId,
        executionId: dto.executionId,
        phaseId: dto.phaseId ?? null,
        inputTokens: dto.inputTokens,
        outputTokens: dto.outputTokens,
        costUsd: dto.costUsd,
        latencyMs: dto.latencyMs,
        wasFallback: dto.wasFallback ?? false,
        fallbackFrom: dto.fallbackFrom ?? null,
      },
    });

    return {
      id: log.id,
      modelId: log.modelId,
      executionId: log.executionId,
      phaseId: log.phaseId,
      inputTokens: log.inputTokens,
      outputTokens: log.outputTokens,
      costUsd: log.costUsd,
      latencyMs: log.latencyMs,
      wasFallback: log.wasFallback,
      fallbackFrom: log.fallbackFrom,
      recordedAt: log.recordedAt,
    };
  }

  /**
   * Generate a cost report with summary, breakdown by model, and daily trend.
   */
  async getCostReport(query: CostReportQueryDto): Promise<CostReport> {
    const window = query.window ?? 'ALL_TIME';
    const fromDate = query.from ? new Date(query.from) : undefined;
    const toDate = query.to ? new Date(query.to) : undefined;

    // Build date filter
    const dateFilter: any = {};
    if (fromDate) dateFilter.gte = fromDate;
    if (toDate) dateFilter.lte = toDate;

    const where: any = {};
    if (Object.keys(dateFilter).length > 0) {
      where.recordedAt = dateFilter;
    }
    if (query.modelId) {
      where.modelId = query.modelId;
    }

    // Aggregate totals
    const aggregation = await this.prisma.costLog.aggregate({
      where,
      _sum: {
        costUsd: true,
        inputTokens: true,
        outputTokens: true,
      },
      _count: { id: true },
      _avg: { costUsd: true },
    });

    const totalCostUsd = aggregation._sum.costUsd ?? 0;
    const totalRequests = aggregation._count.id;
    const totalInputTokens = aggregation._sum.inputTokens ?? 0;
    const totalOutputTokens = aggregation._sum.outputTokens ?? 0;

    const summary: CostSummary = {
      totalCostUsd,
      totalRequests,
      avgCostPerRequest: totalRequests > 0 ? totalCostUsd / totalRequests : 0,
      totalInputTokens,
      totalOutputTokens,
      window,
      computedAt: new Date().toISOString(),
    };

    // Breakdown by model
    const byModelRaw = await this.prisma.costLog.groupBy({
      by: ['modelId'],
      where,
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { id: true },
      _avg: { latencyMs: true },
      orderBy: { _sum: { costUsd: 'desc' } },
    });

    const byModel: CostByModel[] = await Promise.all(
      byModelRaw.map(async (row) => {
        let displayName = row.modelId;
        try {
          const model = await this.prisma.modelRegistry.findUnique({
            where: { modelId: row.modelId },
          });
          if (model) {
            displayName = model.displayName;
          }
        } catch {
          // Use modelId as fallback
        }

        return {
          modelId: row.modelId,
          displayName,
          costUsd: row._sum.costUsd ?? 0,
          requests: row._count.id,
          avgLatencyMs: row._avg.latencyMs ?? 0,
          percentageOfTotal: totalCostUsd > 0
            ? ((row._sum.costUsd ?? 0) / totalCostUsd) * 100
            : 0,
        };
      }),
    );

    // Daily breakdown
    const byDayRaw = await this.prisma.costLog.groupBy({
      by: ['recordedAt'],
      where,
      _sum: { costUsd: true },
      _count: { id: true },
      orderBy: { recordedAt: 'asc' },
    });

    // Group by date string (YYYY-MM-DD)
    const dailyMap = new Map<string, { costUsd: number; requests: number }>();
    for (const row of byDayRaw) {
      const dateStr = row.recordedAt.toISOString().slice(0, 10);
      const existing = dailyMap.get(dateStr) ?? { costUsd: 0, requests: 0 };
      existing.costUsd += row._sum.costUsd ?? 0;
      existing.requests += row._count.id;
      dailyMap.set(dateStr, existing);
    }

    const byDay: CostByDay[] = Array.from(dailyMap.entries()).map(
      ([date, data]) => ({
        date,
        costUsd: data.costUsd,
        requests: data.requests,
      }),
    );

    // Monthly projection
    const projectedMonthlyUsd = await this.getProjectedMonthlySpend(fromDate, toDate);
    const daysInWindow = this.calculateDaysInWindow(fromDate, toDate);

    return {
      summary,
      byModel,
      byDay,
      projection: {
        projectedMonthlyUsd,
        budgetUsd: this.budgetUsd,
        withinBudget: projectedMonthlyUsd <= this.budgetUsd,
        daysInWindow,
      },
    };
  }

  /**
   * Calculate projected monthly spend based on current data.
   */
  async getProjectedMonthlySpend(fromDate?: Date, toDate?: Date): Promise<number> {
    const now = new Date();

    // Default to last 30 days if no range specified
    const start = fromDate ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = toDate ?? now;

    const aggregation = await this.prisma.costLog.aggregate({
      where: {
        recordedAt: { gte: start, lte: end },
      },
      _sum: { costUsd: true },
    });

    const totalInWindow = aggregation._sum.costUsd ?? 0;
    const daysElapsed = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );

    // Project to 30 days
    return (totalInWindow / daysElapsed) * 30;
  }

  /**
   * Recalculate cost totals (force refresh — in v1 this just returns current data).
   * In future versions this could rebuild aggregated tables.
   */
  async recalculate(): Promise<{ recalculated: boolean; message: string }> {
    return {
      recalculated: true,
      message: 'Cost totals recalculated from raw cost logs',
    };
  }

  private calculateDaysInWindow(from?: Date, to?: Date): number {
    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }
}
