/* @lifecycle ACTIVE — SectionRegistry: section storage and dual-graph attachment (TASK-060) */

import * as fs from 'fs';
import * as path from 'path';
import {
  RuleSection,
  SectionRegistryIndex,
  RuleFileAST,
  SectionGraph,
  DualGraph,
  DependencyGraph,
  SimilarityGraph,
} from '../ir/types';
import { RuleFileParser } from '../parser/RuleFileParser';

export class SectionRegistry {
  private sections: Map<string, RuleSection>;
  private fileASTs: RuleFileAST[];
  private graph: SectionGraph | null = null;
  private dualGraph: DualGraph | null = null;

  constructor(sections: Map<string, RuleSection>, fileASTs: RuleFileAST[]) {
    this.sections = sections;
    this.fileASTs = fileASTs;
  }

  resolve(id: string): RuleSection | null {
    return this.sections.get(id) ?? null;
  }

  getAll(): RuleSection[] {
    return Array.from(this.sections.values());
  }

  getBySource(source: string): RuleSection[] {
    return this.getAll().filter((s) => s.source === source);
  }

  attachGraph(graph: SectionGraph): void {
    this.graph = graph;
  }

  getGraph(): SectionGraph | null {
    return this.graph ?? (this.dualGraph?.dependency as unknown as SectionGraph ?? null);
  }

  attachDualGraph(graph: DualGraph): void {
    this.dualGraph = graph;
  }

  getDependencyGraph(): DependencyGraph | null {
    return this.dualGraph?.dependency ?? null;
  }

  getSimilarityGraph(): SimilarityGraph | null {
    return this.dualGraph?.similarity ?? null;
  }

  resolveDependencies(seedIds: string[]): RuleSection[] {
    const visited = new Set<string>();
    const queue = [...seedIds];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const section = this.sections.get(id);
      if (!section) continue;

      if (section.dependsOn) {
        for (const depId of section.dependsOn) {
          if (!visited.has(depId) && this.sections.has(depId)) {
            queue.push(depId);
          }
        }
      }
    }

    return Array.from(visited)
      .map((id) => this.sections.get(id)!)
      .filter(Boolean);
  }

  toIndex(): SectionRegistryIndex {
    return {
      files: this.fileASTs,
      sectionCount: this.sections.size,
      generatedAt: new Date().toISOString(),
    };
  }

  static async build(rulesDir: string): Promise<SectionRegistry> {
    const parser = new RuleFileParser();
    const mdFiles = walkMdFiles(rulesDir);
    const sections = new Map<string, RuleSection>();
    const fileASTs: RuleFileAST[] = [];

    for (const filePath of mdFiles) {
      const ast = parser.parse(filePath);
      fileASTs.push(ast);
      for (const section of ast.sections) {
        sections.set(section.id, section);
      }
    }

    const registry = new SectionRegistry(sections, fileASTs);

    return registry;
  }
}

function walkMdFiles(dir: string): string[] {
  const results: string[] = [];
  let items: string[];
  try {
    items = fs.readdirSync(dir);
  } catch {
    return results;
  }
  for (const item of items) {
    const fullPath = path.join(dir, item);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...walkMdFiles(fullPath));
    } else if (stat.isFile() && item.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}
