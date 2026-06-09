// @lifecycle ACTIVE — Router accuracy computation service

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { getConfidenceInterval } from '../../shared/utils/confidence-interval.util';

export interface RouteBreakdown {
  route: string;
  total: number;
  consistent: number;
  inconsistent: number;
  ambiguous: number;
}

export interface RouterEvaluationResult {
  accuracy: number | null;
  totalRouted: number;
  outcomeConsistent: number;
  outcomeInconsistent: number;
  ambiguous: number;
  confidenceInterval: { low: number; high: number; width: number };
  byRoute: RouteBreakdown[];
}

@Injectable()
export class RouterEvaluatorService {
  private readonly logger = new Logger(RouterEvaluatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute router accuracy from all execution traces.
   *
   * Outcome-consistent (counts as correct):
   *   - L1: codeAttempts > 0 AND finalOutcome = 'COMMITTED'
   *   - L2/L3: planTaskCount > 0 AND finalOutcome IN ('COMMITTED','BLOCKED')
   *   - Default (unmatched): counted as consistent (bias toward Router correctness)
   *
   * Outcome-inconsistent (counts as wrong):
   *   - L1: archReviewed = true OR preVerifyDecision = 'BLOCK'
   *
   * Ambiguous (not counted as wrong):
   *   - L3: codeAttempts = 1 AND planTaskCount <= 1
   */
  async compute(): Promise<RouterEvaluationResult> {
    const executions = await this.prisma.agentExecution.findMany();

    if (executions.length === 0) {
      return {
        accuracy: null,
        totalRouted: 0,
        outcomeConsistent: 0,
        outcomeInconsistent: 0,
        ambiguous: 0,
        confidenceInterval: { low: 0, high: 100, width: 100 },
        byRoute: [],
      };
    }

    let outcomeConsistent = 0;
    let outcomeInconsistent = 0;
    let ambiguous = 0;

    const routeMap = new Map<string, { total: number; consistent: number; inconsistent: number; ambiguous: number }>();

    for (const exec of executions) {
      const route = exec.routerRoute;

      if (!routeMap.has(route)) {
        routeMap.set(route, { total: 0, consistent: 0, inconsistent: 0, ambiguous: 0 });
      }
      const routeData = routeMap.get(route)!;
      routeData.total++;

      // Check ambiguous first (L3 edge case)
      if (route === 'LEVEL_3' && exec.codeAttempts === 1 && (exec.planTaskCount ?? 0) <= 1) {
        ambiguous++;
        routeData.ambiguous++;
        continue;
      }

      // Check inconsistent (L1 that should have been escalated)
      if (route === 'LEVEL_1' && (exec.archReviewed || exec.preVerifyDecision === 'BLOCK')) {
        outcomeInconsistent++;
        routeData.inconsistent++;
        continue;
      }

      // Check consistent
      if (route === 'LEVEL_1' && exec.codeAttempts > 0 && exec.finalOutcome === 'COMMITTED') {
        outcomeConsistent++;
        routeData.consistent++;
        continue;
      }

      if (
        (route === 'LEVEL_2' || route === 'LEVEL_3') &&
        (exec.planTaskCount ?? 0) > 0 &&
        (exec.finalOutcome === 'COMMITTED' || exec.finalOutcome === 'BLOCKED')
      ) {
        outcomeConsistent++;
        routeData.consistent++;
        continue;
      }

      // Default: count as consistent (bias toward Router correctness)
      outcomeConsistent++;
      routeData.consistent++;
    }

    const totalRouted = executions.length;
    const evaluated = outcomeConsistent + outcomeInconsistent;
    const accuracy = evaluated > 0 ? outcomeConsistent / evaluated : null;

    const ci = accuracy !== null
      ? getConfidenceInterval(accuracy, evaluated)
      : { lower: 0, upper: 100, width: 100 };

    const byRoute = Array.from(routeMap.entries())
      .map(([route, data]) => ({
        route,
        total: data.total,
        consistent: data.consistent,
        inconsistent: data.inconsistent,
        ambiguous: data.ambiguous,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      accuracy,
      totalRouted,
      outcomeConsistent,
      outcomeInconsistent,
      ambiguous,
      confidenceInterval: { low: ci.lower, high: ci.upper, width: ci.width },
      byRoute,
    };
  }
}
