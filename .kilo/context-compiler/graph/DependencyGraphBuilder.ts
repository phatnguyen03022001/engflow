/* @lifecycle ACTIVE — DependencyGraphBuilder: strict, directed dependency graph for cost propagation (TASK-060) */

import { RuleSection, DependencyGraph, DependencyEdge, GraphStats } from '../ir/types';
import { SectionRegistry } from '../registry/SectionRegistry';

const FILE_SHORT_NAMES: [string, string][] = [
  ['agent.rules', 'agent'],
  ['domain.rules', 'domain'],
  ['execution.rules', 'execution'],
  ['performance.rules', 'performance'],
  ['quality.rules', 'quality'],
  ['testing.rules', 'testing'],
  ['execution.contract', 'execution.contract'],
  ['source-of-truth.contract', 'source-of-truth'],
];

const FILE_NAMES = FILE_SHORT_NAMES.map(n => n[0]);

export class DependencyGraphBuilder {
  private registry: SectionRegistry;
  private edges: Map<string, DependencyEdge> = new Map();

  constructor(registry: SectionRegistry) {
    this.registry = registry;
  }

  build(): DependencyGraph {
    const sections = this.registry.getAll();

    this.detectExplicitReferences(sections);

    const allIds = sections.map(s => s.id);
    const finalEdges = Array.from(this.edges.values());

    const sccs = this.detectCycles(finalEdges, allIds);
    const stats = this.computeStats(allIds, sccs);

    return {
      nodes: allIds,
      edges: finalEdges,
      stats,
    };
  }

  private addEdge(sourceId: string, targetId: string, weight: number, relation: DependencyEdge['relation'], method: DependencyEdge['method']): void {
    if (sourceId === targetId) return;
    const key = `${sourceId}||${targetId}`;
    const existing = this.edges.get(key);
    if (!existing || weight > existing.weight) {
      this.edges.set(key, { sourceId, targetId, weight, costImpact: 0, traversalCost: 0, relation, method });
    }
  }

  private detectExplicitReferences(sections: RuleSection[]): void {
    const headingMap = new Map<string, string>();
    const sourceMap = new Map<string, RuleSection[]>();
    for (const section of sections) {
      if (section.headingNumber) {
        headingMap.set(section.headingNumber, section.id);
      }
      const stem = section.source.replace(/\.\w+$/, '');
      const list = sourceMap.get(stem) ?? [];
      list.push(section);
      sourceMap.set(stem, list);
    }

    for (const section of sections) {
      const contentLower = section.content.toLowerCase();

      const sectionRefs = contentLower.match(/§\d+(?:\.\d+)*/g) ?? [];
      for (const ref of sectionRefs) {
        const refKey = ref.replace('§', '');
        const exactTarget = headingMap.get(refKey);
        if (exactTarget) {
          this.addEdge(section.id, exactTarget, 1.0, 'depends_on', '§_reference');
        } else {
          const parts = refKey.split('.');
          if (parts.length > 1) {
            const parentTarget = headingMap.get(parts[0]);
            if (parentTarget) {
              this.addEdge(section.id, parentTarget, 0.9, 'references', '§_reference');
            }
          }
        }
      }

      for (const fname of FILE_NAMES) {
        if (contentLower.includes(fname)) {
          const targetSections = sourceMap.get(fname);
          if (targetSections) {
            for (const target of targetSections) {
              if (target.id === section.id) continue;
              this.addEdge(section.id, target.id, 0.9, 'references', 'file_reference');
            }
          }
        }
      }

      if (contentLower.includes('constitution')) {
        const constRefMatch = contentLower.match(/constitution\s*§\s*(\d+)/);
        if (constRefMatch) {
          const constSectionNum = constRefMatch[1];
          const targetSections = sourceMap.get('source-of-truth.contract');
          if (targetSections) {
            let matched = false;
            for (const target of targetSections) {
              if (target.headingNumber === constSectionNum) {
                this.addEdge(section.id, target.id, 1.0, 'depends_on', 'constitution_ref');
                matched = true;
                break;
              }
            }
            if (!matched) {
              for (const target of targetSections) {
                this.addEdge(section.id, target.id, 0.9, 'depends_on', 'constitution_ref');
              }
            }
          }
        }
      }
    }
  }

  private detectCycles(edges: DependencyEdge[], nodes: string[]): string[][] {
    const adj = new Map<string, string[]>();
    for (const node of nodes) {
      adj.set(node, []);
    }
    for (const edge of edges) {
      const list = adj.get(edge.sourceId);
      if (list) list.push(edge.targetId);
    }

    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Map<string, boolean>();
    const stack: string[] = [];
    const sccs: string[][] = [];
    let currentIndex = 0;

    function strongconnect(v: string): void {
      index.set(v, currentIndex);
      lowlink.set(v, currentIndex);
      currentIndex++;
      stack.push(v);
      onStack.set(v, true);

      const neighbors = adj.get(v) ?? [];
      for (const w of neighbors) {
        if (!index.has(w)) {
          strongconnect(w);
          lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
        } else if (onStack.get(w)) {
          lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
        }
      }

      if (lowlink.get(v) === index.get(v)) {
        const scc: string[] = [];
        let w: string | undefined;
        do {
          w = stack.pop()!;
          onStack.set(w, false);
          scc.push(w);
        } while (w !== v);
        sccs.push(scc);
      }
    }

    for (const node of nodes) {
      if (!index.has(node)) {
        strongconnect(node);
      }
    }

    for (const scc of sccs) {
      if (scc.length > 1) {
        const sectionNames = scc.map(id => {
          const section = this.registry.resolve(id);
          return section ? `${section.source}/${section.title}` : id;
        });
        const level = scc.length > 3 ? 'WARNING' : 'INFO';
        process.stderr.write(`  [${level}] Cycle detected in dependency graph (SCC size ${scc.length}): ${sectionNames.join(' → ')}\n`);
      }
    }

    return sccs;
  }

  private computeStats(nodes: string[], sccs: string[][]): GraphStats {
    const nodeCount = nodes.length;
    const edgeCount = this.edges.size;
    const maxEdges = nodeCount * (nodeCount - 1);
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;
    const avgEdgesPerNode = nodeCount > 0 ? edgeCount / nodeCount : 0;

    let cycleCount = 0;
    let stronglyConnectedSize = 0;
    for (const scc of sccs) {
      if (scc.length > 1) {
        cycleCount++;
        if (scc.length > stronglyConnectedSize) {
          stronglyConnectedSize = scc.length;
        }
      }
    }

    return {
      nodeCount,
      edgeCount,
      density,
      avgEdgesPerNode,
      cycleCount,
      stronglyConnectedSize,
    };
  }
}
