/* @lifecycle ACTIVE — Rule Mapper: scan rule files, parse @tags, filter by agent/task (TASK-036) */

import * as fs from 'fs';
import * as path from 'path';

// ─── Constants ──────────────────────────────────────────────────────────

const RULES_DIR = path.resolve(__dirname, '..', 'rules');

/**
 * Map of agent types to relevant tag categories.
 * Agents that need comprehensive context (plan, architect, verifiers)
 * return '__all__' which includes every rule file.
 */
const AGENT_TAG_MAP: Record<string, string[]> = {
  code: ['backend', 'coding', 'testing', 'database', 'infra', 'devops'],
  plan: ['__all__'],
  architect: ['__all__'],
  pre_verify: ['__all__'],
  post_verify: ['__all__'],
  router: ['__all__'],
};

// ─── Types ───────────────────────────────────────────────────────────────

interface RuleFileEntry {
  /** Absolute path to the rule file. */
  path: string;
  /** Parsed tags from the @tags header. */
  tags: string[];
}

// ─── RuleMapper ─────────────────────────────────────────────────────────

export class RuleMapper {
  private files: RuleFileEntry[] = [];

  constructor() {
    this.files = this.scan();
  }

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Return absolute file paths matching the given agent type and task type.
   *
   * Filtering logic:
   * 1. Files tagged with 'all' are always included.
   * 2. If the agent has '__all__' in its tag map, return ALL files.
   * 3. Otherwise, return files whose tags intersect with the agent's
   *    relevant tag set.
   * 4. If taskType is provided and is not 'default', it acts as an
   *    additional required tag (files must also have this tag).
   */
  getFilesForTask(agentType: string, taskType: string = 'default'): string[] {
    const relevantTags = AGENT_TAG_MAP[agentType];

    // Unknown agent → return everything (safe default)
    if (!relevantTags) {
      return this.files.map((f) => f.path);
    }

    // '__all__' agents get every rule file
    if (relevantTags.includes('__all__')) {
      return this.files.map((f) => f.path);
    }

    const results: string[] = [];

    for (const file of this.files) {
      // Always include 'all' tagged files
      if (file.tags.includes('all')) {
        results.push(file.path);
        continue;
      }

      // Check intersection with agent's relevant tags
      const hasRelevantTag = file.tags.some((t) => relevantTags.includes(t));
      if (!hasRelevantTag) continue;

      // If taskType is specified and non-default, also require that tag
      if (taskType !== 'default' && !file.tags.includes(taskType)) continue;

      results.push(file.path);
    }

    return results;
  }

  /**
   * Return all scanned rule file entries (useful for debugging / testing).
   */
  getAllEntries(): RuleFileEntry[] {
    return [...this.files];
  }

  // ─── Private ────────────────────────────────────────────────────

  /**
   * Recursively scan .kilo/rules/ for all .md files and parse @tags.
   */
  private scan(): RuleFileEntry[] {
    const entries: RuleFileEntry[] = [];

    if (!fs.existsSync(RULES_DIR)) {
      return entries;
    }

    const mdFiles = this.walkMdFiles(RULES_DIR);

    for (const filePath of mdFiles) {
      const tags = this.parseTags(filePath);
      entries.push({ path: filePath, tags });
    }

    return entries;
  }

  /**
   * Recursively collect all .md files under a directory.
   */
  private walkMdFiles(dir: string): string[] {
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
        results.push(...this.walkMdFiles(fullPath));
      } else if (stat.isFile() && item.endsWith('.md')) {
        results.push(fullPath);
      }
    }

    return results;
  }

  /**
   * Parse the @tags header from a rule file.
   * Looks for a line matching: /* @tags <tag1>, <tag2>, ... *​/
   * Returns an empty array if no tags line is found.
   */
  private parseTags(filePath: string): string[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(
          /^\/\*\s*@tags\s+(.+?)\s*\*\/\s*$/,
        );
        if (match) {
          return match[1].split(',').map((t) => t.trim()).filter(Boolean);
        }
      }
    } catch {
      // File unreadable → no tags
    }

    return [];
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────

let ruleMapperInstance: RuleMapper | null = null;

/**
 * Get or create the singleton RuleMapper instance.
 */
export function getRuleMapper(): RuleMapper {
  if (!ruleMapperInstance) {
    ruleMapperInstance = new RuleMapper();
  }
  return ruleMapperInstance;
}

/**
 * Reset the RuleMapper singleton (for testing).
 */
export function resetRuleMapper(): void {
  ruleMapperInstance = null;
}
