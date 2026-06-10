/* @lifecycle ACTIVE — ContextPlanner: agent-aware section selection using DependencyGraph (TASK-NNN) */

import { RuleSection, DependencyGraph, AgentType, PlannedSection } from '../ir/types';
import { SectionRegistry } from '../registry/SectionRegistry';

const AGENT_TAG_MAP: Record<string, string[]> = {
  router: ['all', 'backend', 'architecture'],
  plan: ['all', 'backend'],
  code: ['coding', 'backend'],
  debug: ['coding', 'backend'],
  ask: ['all', 'backend'],
  'architect-quick': ['architecture', 'backend'],
  'architect-deep': ['architecture', 'database', 'backend'],
  pre_verify: ['all', 'backend', 'testing'],
  post_verify: ['testing', 'backend'],
};

const TOKENS_PER_SECTION_OVERHEAD = 8;

export class ContextPlanner {
  private registry: SectionRegistry;
  private graph: DependencyGraph;

  constructor(registry: SectionRegistry) {
    this.registry = registry;
    const graph = registry.getDependencyGraph();
    if (!graph) {
      throw new Error(
        'ContextPlanner requires the SectionRegistry to have an attached DependencyGraph. ' +
          'Call buildGraph() first.',
      );
    }
    this.graph = graph;
  }

  plan(agentType: string, tokenBudget: number = 4096): PlannedSection[] {
    const relevantTags = AGENT_TAG_MAP[agentType] ?? ['all'];
    const allSections = this.registry.getAll();

    const seedIds = this.computeSeedIds(allSections, relevantTags);
    if (seedIds.size === 0) return [];

    const dependencyExpanded = this.registry.resolveDependencies(Array.from(seedIds));
    const candidateIds = new Set<string>(seedIds);
    for (const section of dependencyExpanded) {
      candidateIds.add(section.id);
    }

    const adj = this.buildAdjacencyList();

    const pathWeights = new Map<string, number[]>();
    const visited = new Set<string>();
    const queue: string[] = [];

    for (const sid of seedIds) {
      pathWeights.set(sid, []);
      visited.add(sid);
      queue.push(sid);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentWeights = pathWeights.get(current) ?? [];
      const neighbors = adj.get(current) ?? [];

      for (const { neighbor, weight } of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        pathWeights.set(neighbor, [...currentWeights, weight]);
        candidateIds.add(neighbor);
        queue.push(neighbor);
      }
    }

    const scored: { id: string; score: number; costAdjustedScore: number; section: RuleSection }[] = [];

    for (const id of candidateIds) {
      const section = this.registry.resolve(id);
      if (!section) continue;

      let score: number;
      if (seedIds.has(id)) {
        score = 1.0;
      } else {
        const weights = pathWeights.get(id);
        if (weights && weights.length > 0) {
          score = weights.reduce((a, b) => a + b, 0) / weights.length;
        } else {
          score = 0;
        }
      }

      score = Math.max(score, section.relevanceScore);

      const cost = section.cost;
      let costAdjustedScore: number;
      if (cost) {
        costAdjustedScore = score / (cost.cumulative + cost.risk * 10);
      } else {
        costAdjustedScore = score;
      }

      scored.push({ id, score, costAdjustedScore, section });
    }

    scored.sort((a, b) => b.costAdjustedScore - a.costAdjustedScore);

    const result: PlannedSection[] = [];
    let tokensUsed = 0;

    for (const item of scored) {
      const sectionTokens = item.section.tokensEst + TOKENS_PER_SECTION_OVERHEAD;
      if (tokensUsed + sectionTokens <= tokenBudget) {
        const cost = item.section.cost;
        result.push({
          sectionId: item.id,
          relevanceScore: item.score,
          costScore: item.costAdjustedScore,
          cumulativeCost: cost?.cumulative,
        });
        tokensUsed += sectionTokens;
      } else if (result.length === 0) {
        const cost = item.section.cost;
        result.push({
          sectionId: item.id,
          relevanceScore: item.score,
          costScore: item.costAdjustedScore,
          cumulativeCost: cost?.cumulative,
        });
        break;
      } else {
        break;
      }
    }

    return result;
  }

  private computeSeedIds(allSections: RuleSection[], relevantTags: string[]): Set<string> {
    const seedIds = new Set<string>();
    for (const section of allSections) {
      for (const tag of section.tags) {
        if (relevantTags.includes(tag)) {
          seedIds.add(section.id);
          break;
        }
      }
    }
    return seedIds;
  }

  private buildAdjacencyList(): Map<string, { neighbor: string; weight: number }[]> {
    const adj = new Map<string, { neighbor: string; weight: number }[]>();
    for (const node of this.graph.nodes) {
      adj.set(node, []);
    }
    for (const edge of this.graph.edges) {
      const sourceList = adj.get(edge.sourceId);
      if (sourceList) sourceList.push({ neighbor: edge.targetId, weight: edge.weight });
      const targetList = adj.get(edge.targetId);
      if (targetList) targetList.push({ neighbor: edge.sourceId, weight: edge.weight });
    }
    return adj;
  }
}
