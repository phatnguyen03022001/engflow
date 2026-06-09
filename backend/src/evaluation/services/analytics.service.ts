/* @lifecycle ACTIVE — Analytics dashboard service (ADR-014) */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { QueryAnalyticsDto } from '../dto/query-analytics.dto';

/**
 * Aggregate row returned by getAgentPerformance.
 */
export interface AgentPerformanceRow {
  agentType: string;
  totalExecutions: number;
  successCount: number;
  successRate: number;
  avgDurationMs: number;
}

/**
 * Time-bucketed throughput row.
 */
export interface ThroughputRow {
  period: string;
  count: number;
}

/**
 * Bottleneck row — identifies slow or problematic phases.
 */
export interface BottleneckRow {
  agentType: string;
  phaseOrder: number;
  totalPhases: number;
  avgDurationMs: number;
  maxDurationMs: number;
}

/**
 * Cost trend row aggregated by time period.
 */
export interface CostTrendRow {
  period: string;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  executionCount: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Agent Performance ─────────────────────────────────────────────

  /**
   * Aggregate success rate and average duration across agent executions,
   * grouped by agent type (routerRoute or phase agentType).
   *
   * Uses AgentExecution.groupBy for outcome-based success rate and
   * ExecutionPhase groupBy for per-agent duration averages.
   */
  async getAgentPerformance(
    filters: QueryAnalyticsDto,
  ): Promise<{ items: AgentPerformanceRow[]; total: number }> {
    const where = this.buildDateWhere(filters);
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 20, 100);

    // Success rate by finalOutcome from AgentExecution
    const outcomeGroups = await this.prisma.agentExecution.groupBy({
      by: ['finalOutcome'],
      where,
      _count: { id: true },
    });

    const totalMap: Record<string, number> = {};
    let grandTotal = 0;
    for (const g of outcomeGroups) {
      totalMap[g.finalOutcome] = g._count.id;
      grandTotal += g._count.id;
    }

    const successCount = totalMap['COMMITTED'] ?? 0;
    const successRate = grandTotal > 0 ? successCount / grandTotal : 0;
    const totalExecutions = grandTotal;

    // Average duration per agent type from ExecutionPhase
    const phaseWhere: any = { ...where };
    if (filters.agentType) {
      phaseWhere.agentType = filters.agentType;
    }

    const durationGroups = await this.prisma.executionPhase.groupBy({
      by: ['agentType'],
      where: phaseWhere,
      _avg: { durationMs: true },
      _count: { id: true },
    });

    // Map observed agent types to rows
    const items: AgentPerformanceRow[] = durationGroups.map((g) => ({
      agentType: g.agentType,
      totalExecutions: g._count.id,
      successCount,
      successRate: Math.round(successRate * 10000) / 10000,
      avgDurationMs: g._avg.durationMs
        ? Math.round(g._avg.durationMs)
        : 0,
    }));

    // If no phase data but we have executions, return a summary row
    if (items.length === 0 && grandTotal > 0) {
      items.push({
        agentType: filters.agentType ?? 'ALL',
        totalExecutions,
        successCount,
        successRate: Math.round(successRate * 10000) / 10000,
        avgDurationMs: 0,
      });
    }

    const sliced = items.slice(skip, skip + take);
    return { items: sliced, total: items.length };
  }

  // ─── Throughput ────────────────────────────────────────────────────

  /**
   * Count agent executions grouped by day (date-truncated createdAt).
   * Uses raw SQL for date truncation since Prisma groupBy groups by
   * exact timestamp values.
   */
  async getThroughput(
    filters: QueryAnalyticsDto,
  ): Promise<{ items: ThroughputRow[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.from) {
      conditions.push('ae.created_at >= $' + (params.length + 1));
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push('ae.created_at <= $' + (params.length + 1));
      params.push(filters.to);
    }
    if (filters.routerRoute) {
      conditions.push('ae.router_route = $' + (params.length + 1));
      params.push(filters.routerRoute);
    }

    const whereClause =
      conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const sql = `
      SELECT
        DATE(ae.created_at) AS period,
        COUNT(*)::int AS count
      FROM agent_executions ae
      ${whereClause}
      GROUP BY DATE(ae.created_at)
      ORDER BY period DESC
    `;

    const rows = await this.prisma.$queryRawUnsafe<ThroughputRow[]>(sql, ...params);

    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 20, 100);
    const sliced = rows.slice(skip, skip + take);

    return { items: sliced, total: rows.length };
  }

  // ─── Bottlenecks ───────────────────────────────────────────────────

  /**
   * Identify slowest phases and most retried stages.
   * Groups ExecutionPhase by agentType and phaseOrder, computing
   * average and max duration.
   */
  async getBottlenecks(
    filters: QueryAnalyticsDto,
  ): Promise<{ items: BottleneckRow[]; total: number }> {
    const where: any = {};
    if (filters.agentType) {
      where.agentType = filters.agentType;
    }
    if (filters.from) {
      where.recordedAt = { ...where.recordedAt, gte: filters.from };
    }
    if (filters.to) {
      where.recordedAt = { ...where.recordedAt, lte: filters.to };
    }

    const groups = await this.prisma.executionPhase.groupBy({
      by: ['agentType', 'phaseOrder'],
      where,
      _avg: { durationMs: true },
      _max: { durationMs: true },
      _count: { id: true },
      orderBy: { _avg: { durationMs: 'desc' } },
    });

    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 20, 100);

    const items: BottleneckRow[] = groups.map((g) => ({
      agentType: g.agentType,
      phaseOrder: g.phaseOrder,
      totalPhases: g._count.id,
      avgDurationMs: g._avg.durationMs
        ? Math.round(g._avg.durationMs)
        : 0,
      maxDurationMs: g._max.durationMs ?? 0,
    }));

    const sliced = items.slice(skip, skip + take);
    return { items: sliced, total: items.length };
  }

  // ─── Cost Trends ───────────────────────────────────────────────────

  /**
   * Aggregate cost data from CostLog, grouped by day.
   * Uses raw SQL for date truncation.
   */
  async getCostTrends(
    filters: QueryAnalyticsDto,
  ): Promise<{ items: CostTrendRow[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.from) {
      conditions.push('cl.recorded_at >= $' + (params.length + 1));
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push('cl.recorded_at <= $' + (params.length + 1));
      params.push(filters.to);
    }

    const whereClause =
      conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const sql = `
      SELECT
        DATE(cl.recorded_at)::text AS period,
        COALESCE(SUM(cl.cost_usd), 0)::float8 AS "totalCostUsd",
        COALESCE(SUM(cl.input_tokens), 0)::int AS "totalInputTokens",
        COALESCE(SUM(cl.output_tokens), 0)::int AS "totalOutputTokens",
        COUNT(DISTINCT cl.execution_id)::int AS "executionCount"
      FROM cost_logs cl
      ${whereClause}
      GROUP BY DATE(cl.recorded_at)
      ORDER BY period DESC
    `;

    const rows = await this.prisma.$queryRawUnsafe<CostTrendRow[]>(sql, ...params);

    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 20, 100);
    const sliced = rows.slice(skip, skip + take);

    return { items: sliced, total: rows.length };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /**
   * Build a Prisma `where` clause for date-range filtering.
   */
  private buildDateWhere(filters: QueryAnalyticsDto): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (filters.from || filters.to) {
      const createdAt: Record<string, Date> = {};
      if (filters.from) {
        createdAt.gte = filters.from;
      }
      if (filters.to) {
        createdAt.lte = filters.to;
      }
      where.createdAt = createdAt;
    }
    return where;
  }
}
