/* @lifecycle ACTIVE — DefaultOptimizerPipeline: sequential pass execution with cost-delta verification and rollback (TASK-NNN) */

import {
  DependencyGraph,
  OptimizationPass,
  OptimizationResult,
  OptimizationRunResult,
  CostDelta,
  PipelineDiagnostics,
} from '../ir/types';

export class DefaultOptimizerPipeline {
  private passes: OptimizationPass[] = [];

  register(pass: OptimizationPass): void {
    this.passes.push(pass);
  }

  run(ir: DependencyGraph): OptimizationRunResult {
    const startTime = Date.now();
    const passResults: OptimizationResult[] = [];
    const rejectedPasses: string[] = [];
    let currentGraph = ir;
    let rollbackCount = 0;

    for (const pass of this.passes) {
      const result = pass.run(currentGraph);

      if (this.isValidDelta(result.delta)) {
        passResults.push(result);
        currentGraph = result.graph;
      } else {
        rejectedPasses.push(pass.name);
        rollbackCount++;
      }
    }

    const totalDuration = Date.now() - startTime;
    const totalDelta = this.aggregateDelta(passResults);

    const diagnostics: PipelineDiagnostics = {
      totalDurationMs: totalDuration,
      passOrder: this.passes.map(p => p.name),
      rollbackCount,
      netGainTokens: totalDelta.savings,
      netRiskReduction: -totalDelta.riskDelta,
    };

    return {
      graph: currentGraph,
      totalDelta,
      passResults,
      rejectedPasses,
      diagnostics,
    };
  }

  private isValidDelta(delta: CostDelta): boolean {
    return delta.savings >= 0 || delta.riskDelta < 0;
  }

  private aggregateDelta(results: OptimizationResult[]): CostDelta {
    if (results.length === 0) {
      return {
        totalTokensBefore: 0,
        totalTokensAfter: 0,
        savings: 0,
        savingsPercent: 0,
        nodeReduction: 0,
        edgeReduction: 0,
        riskDelta: 0,
      };
    }

    const first = results[0].delta;
    const last = results[results.length - 1].delta;
    const totalSavings = first.totalTokensBefore - last.totalTokensAfter;

    return {
      totalTokensBefore: first.totalTokensBefore,
      totalTokensAfter: last.totalTokensAfter,
      savings: totalSavings,
      savingsPercent:
        first.totalTokensBefore > 0
          ? (totalSavings / first.totalTokensBefore) * 100
          : 0,
      nodeReduction: results.reduce((s, r) => s + r.delta.nodeReduction, 0),
      edgeReduction: results.reduce((s, r) => s + r.delta.edgeReduction, 0),
      riskDelta: results.reduce((s, r) => s + r.delta.riskDelta, 0),
    };
  }
}
