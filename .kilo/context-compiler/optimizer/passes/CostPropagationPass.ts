/* @lifecycle ACTIVE — CostPropagationPass: cost model with cycle-safe cumulative propagation on DependencyGraph (TASK-060) */

import {
  DependencyGraph,
  DependencyEdge,
  RuleSection,
  OptimizationPass,
  OptimizationResult,
  CostDelta,
  PassDiagnostics,
} from '../../ir/types';
import { SectionRegistry } from '../../registry/SectionRegistry';

export class CostPropagationPass implements OptimizationPass {
  name: string = 'CostPropagationPass';
  private registry: SectionRegistry;

  constructor(registry: SectionRegistry) {
    this.registry = registry;
  }

  run(ir: DependencyGraph): OptimizationResult {
    const startTime = Date.now();
    const sections = this.registry.getAll();
    const sectionsById = new Map(sections.map(s => [s.id, s]));
    const transformations: string[] = [];

    const totalTokensBefore = ir.nodes.reduce((sum, id) => {
      return sum + (sectionsById.get(id)?.tokensEst ?? 0);
    }, 0);
    const totalRiskBefore = ir.nodes.reduce((sum, id) => {
      return sum + (sectionsById.get(id)?.cost?.risk ?? 0);
    }, 0);
    const nodeCountBefore = ir.nodes.length;
    const edgeCountBefore = ir.edges.length;

    ir.adjacency = this.buildAdjacency(ir);
    const adj = ir.adjacency;

    const memo = new Map<string, number>();

    for (const nodeId of ir.nodes) {
      const section = sectionsById.get(nodeId);
      if (!section) continue;

      const self = section.tokensEst;
      const cumulative = this.computeCumulativeCost(nodeId, adj, sectionsById, memo, new Set());
      const outgoing = adj.get(nodeId) ?? [];
      const fanout = outgoing.length;
      const risk = this.computeRisk(outgoing, fanout);
      const density = section.tokensEst / Math.max(section.tags.length, 1);

      section.cost = { self, cumulative, risk, density };
    }

    for (const edge of ir.edges) {
      edge.costImpact = 0;
      edge.traversalCost = (1 - edge.weight) * 10;
    }

    const totalTokensAfter = ir.nodes.reduce((sum, id) => {
      return sum + (sectionsById.get(id)?.cost?.cumulative ?? 0);
    }, 0);
    const totalRiskAfter = ir.nodes.reduce((sum, id) => {
      return sum + (sectionsById.get(id)?.cost?.risk ?? 0);
    }, 0);

    transformations.push(`Computed costs for ${ir.nodes.length} nodes`);
    transformations.push(`Average cumulative cost: ${(totalTokensAfter / Math.max(ir.nodes.length, 1)).toFixed(1)}`);

    const delta: CostDelta = {
      totalTokensBefore,
      totalTokensAfter,
      savings: totalTokensBefore - totalTokensAfter,
      savingsPercent:
        totalTokensBefore > 0
          ? ((totalTokensBefore - totalTokensAfter) / totalTokensBefore) * 100
          : 0,
      nodeReduction: nodeCountBefore - ir.nodes.length,
      edgeReduction: edgeCountBefore - ir.edges.length,
      riskDelta: totalRiskAfter - totalRiskBefore,
    };

    const diagnostics: PassDiagnostics = {
      passName: this.name,
      durationMs: Date.now() - startTime,
      transformations,
      warnings: [],
    };

    return { graph: ir, delta, diagnostics };
  }

  private buildAdjacency(graph: DependencyGraph): Map<string, { targetId: string; weight: number }[]> {
    const adj = new Map<string, { targetId: string; weight: number }[]>();
    for (const node of graph.nodes) {
      adj.set(node, []);
    }
    for (const edge of graph.edges) {
      const list = adj.get(edge.sourceId);
      if (list) {
        list.push({ targetId: edge.targetId, weight: edge.weight });
      }
    }
    return adj;
  }

  private computeCumulativeCost(
    nodeId: string,
    adj: Map<string, { targetId: string; weight: number }[]>,
    sectionsById: Map<string, RuleSection>,
    memo: Map<string, number>,
    path: Set<string>,
  ): number {
    if (memo.has(nodeId)) {
      return memo.get(nodeId)!;
    }

    const section = sectionsById.get(nodeId);
    if (!section) return 0;

    if (path.has(nodeId)) {
      return section.tokensEst;
    }

    path.add(nodeId);

    const self = section.tokensEst;
    const outgoing = adj.get(nodeId) ?? [];
    let childrenSum = 0;
    for (const edge of outgoing) {
      const childCumulative = this.computeCumulativeCost(edge.targetId, adj, sectionsById, memo, path);
      childrenSum += childCumulative;
    }

    path.delete(nodeId);

    const cumulative = self + childrenSum;
    memo.set(nodeId, cumulative);
    return cumulative;
  }

  private computeRisk(
    outgoing: { targetId: string; weight: number }[],
    fanout: number,
  ): number {
    if (fanout === 0) return 0;
    const mean = outgoing.reduce((s, e) => s + e.weight, 0) / fanout;
    const variance = outgoing.reduce((s, e) => s + (e.weight - mean) ** 2, 0) / fanout;
    return fanout * variance;
  }
}
