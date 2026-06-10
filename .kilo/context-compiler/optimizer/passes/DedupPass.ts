/* @lifecycle ACTIVE — DedupPass: structural duplicate detection and graph-safe dedup (TASK-NNN) */

import {
  DependencyGraph,
  RuleSection,
  OptimizationPass,
  OptimizationResult,
  GraphStats,
} from '../../ir/types';
import { SectionRegistry } from '../../registry/SectionRegistry';

interface DuplicateCandidate {
  source: string;
  target: string;
  similarityScore: number;
  costOverlap: number;
}

export class DedupPass implements OptimizationPass {
  name = 'DedupPass';

  constructor(private registry: SectionRegistry) {}

  run(ir: DependencyGraph): OptimizationResult {
    const beforeCost = this.computeTotalCost(ir);
    const beforeNodes = ir.nodes.length;
    const beforeEdges = ir.edges.length;

    const duplicates = this.findDuplicates(ir);
    const result = this.applyDedup(ir, duplicates);

    const afterCost = this.computeTotalCost(result.graph);
    const savings = beforeCost - afterCost;
    const savingsPercent = beforeCost > 0 ? (savings / beforeCost) * 100 : 0;
    const nodeReduction = beforeNodes - result.graph.nodes.length;
    const edgeReduction = beforeEdges - result.graph.edges.length;
    const riskDelta = this.computeRiskDelta(ir, result.graph);

    return {
      graph: result.graph,
      delta: {
        totalTokensBefore: beforeCost,
        totalTokensAfter: afterCost,
        savings,
        savingsPercent: Math.round(savingsPercent * 100) / 100,
        nodeReduction,
        edgeReduction,
        riskDelta,
      },
      diagnostics: {
        passName: this.name,
        durationMs: 0,
        transformations: duplicates.map(d => `merged:${d.target}→${d.source}`),
        warnings: result.warnings,
      },
    };
  }

  private findDuplicates(ir: DependencyGraph): DuplicateCandidate[] {
    const candidates: DuplicateCandidate[] = [];
    const sections = this.registry.getAll();
    const sectionsById = new Map(sections.map(s => [s.id, s]));
    const depsMap = this.buildDepsMap(ir);

    const nodeIds = ir.nodes;
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = sectionsById.get(nodeIds[i]);
        const b = sectionsById.get(nodeIds[j]);
        if (!a || !b) continue;

        const sim = this.structuralSimilarity(a, b, depsMap);
        if (sim > 0.85) {
          const costOverlap = this.computeCostOverlap(a, b, depsMap);
          candidates.push({
            source: a.id,
            target: b.id,
            similarityScore: sim,
            costOverlap,
          });
        }
      }
    }

    candidates.sort((a, b) => b.costOverlap - a.costOverlap);
    return candidates;
  }

  private structuralSimilarity(
    a: RuleSection,
    b: RuleSection,
    depsMap: Map<string, string[]>,
  ): number {
    const tagSim = this.jaccard(a.tags || [], b.tags || []);

    const depsA = depsMap.get(a.id) || [];
    const depsB = depsMap.get(b.id) || [];
    const depSim = this.jaccard(depsA, depsB);

    const aCost = a.cost?.self ?? a.tokensEst;
    const bCost = b.cost?.self ?? b.tokensEst;
    const costSim = 1 - Math.abs(aCost - bCost) / Math.max(aCost, bCost, 1);

    return tagSim * 0.3 + depSim * 0.5 + costSim * 0.2;
  }

  private computeCostOverlap(
    a: RuleSection,
    b: RuleSection,
    depsMap: Map<string, string[]>,
  ): number {
    const depsA = new Set(depsMap.get(a.id) || []);
    const depsB = new Set(depsMap.get(b.id) || []);
    const shared = [...depsA].filter(x => depsB.has(x));
    const avgSelf =
      ((a.cost?.self ?? a.tokensEst) + (b.cost?.self ?? b.tokensEst)) / 2;
    return shared.length * avgSelf;
  }

  private applyDedup(ir: DependencyGraph, duplicates: DuplicateCandidate[]) {
    const graph = this.cloneGraph(ir);
    const removed = new Set<string>();
    let savings = 0;
    let nodeReduction = 0;
    const warnings: string[] = [];

    const fanout = new Map<string, number>();
    for (const edge of graph.edges) {
      fanout.set(edge.sourceId, (fanout.get(edge.sourceId) || 0) + 1);
    }

    for (const dup of duplicates) {
      if (removed.has(dup.source) || removed.has(dup.target)) continue;

      const sourceSection = this.registry.resolve(dup.source);
      const targetSection = this.registry.resolve(dup.target);
      if (!sourceSection || !targetSection) continue;

      if ((fanout.get(dup.target) || 0) >= 2) {
        warnings.push(
          `skipped:${dup.target} (critical dep node, fanout=${fanout.get(dup.target)})`,
        );
        continue;
      }

      const sourceCum =
        sourceSection.cost?.cumulative ?? sourceSection.tokensEst;
      const targetCum =
        targetSection.cost?.cumulative ?? targetSection.tokensEst;
      if (
        Math.abs(sourceCum - targetCum) / Math.max(sourceCum, targetCum, 1) >
        0.3
      ) {
        warnings.push(
          `skipped:${dup.target}→${dup.source} (cost mismatch: ${sourceCum.toFixed(0)} vs ${targetCum.toFixed(0)})`,
        );
        continue;
      }

      const edgesToReroute = graph.edges.filter(
        e => e.targetId === dup.target,
      );
      for (const edge of edgesToReroute) {
        edge.targetId = dup.source;
      }

      const nodeIdx = graph.nodes.indexOf(dup.target);
      if (nodeIdx >= 0) {
        graph.nodes.splice(nodeIdx, 1);
      }

      graph.edges = graph.edges.filter(
        e => e.sourceId !== dup.target && e.targetId !== dup.target,
      );

      removed.add(dup.target);
      savings += targetSection.cost?.self ?? targetSection.tokensEst;
      nodeReduction++;
    }

    graph.stats = this.recomputeStats(graph);

    return { graph, savings, nodeReduction, warnings };
  }

  private jaccard(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private buildDepsMap(ir: DependencyGraph): Map<string, string[]> {
    const deps = new Map<string, string[]>();
    for (const node of ir.nodes) deps.set(node, []);
    for (const edge of ir.edges) {
      const list = deps.get(edge.sourceId);
      if (list) list.push(edge.targetId);
    }
    return deps;
  }

  private computeTotalCost(ir: DependencyGraph): number {
    return ir.nodes.reduce((sum, id) => {
      const section = this.registry.resolve(id);
      return sum + (section?.cost?.cumulative ?? section?.tokensEst ?? 0);
    }, 0);
  }

  private computeRiskDelta(
    before: DependencyGraph,
    after: DependencyGraph,
  ): number {
    const beforeRisk = before.nodes.reduce((sum, id) => {
      const section = this.registry.resolve(id);
      return sum + (section?.cost?.risk ?? 0);
    }, 0);
    const afterRisk = after.nodes.reduce((sum, id) => {
      const section = this.registry.resolve(id);
      return sum + (section?.cost?.risk ?? 0);
    }, 0);
    return afterRisk - beforeRisk;
  }

  private cloneGraph(ir: DependencyGraph): DependencyGraph {
    return {
      nodes: [...ir.nodes],
      edges: ir.edges.map(e => ({ ...e })),
      stats: { ...ir.stats },
    };
  }

  private recomputeStats(graph: DependencyGraph): GraphStats {
    const nodeCount = graph.nodes.length;
    const edgeCount = graph.edges.length;
    const maxEdges = nodeCount * (nodeCount - 1);
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;
    const avgEdgesPerNode = nodeCount > 0 ? edgeCount / nodeCount : 0;

    return {
      nodeCount,
      edgeCount,
      density,
      avgEdgesPerNode,
      cycleCount: 0,
      stronglyConnectedSize: 0,
    };
  }
}
