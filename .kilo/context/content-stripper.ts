/* @lifecycle ACTIVE — Content Stripper: assemble compressed rule context for agents (TASK-036) */

import * as fs from 'fs';
import * as path from 'path';
import { RuleMapper, getRuleMapper } from './rule-mapper';

// ─── Constants ──────────────────────────────────────────────────────────

/**
 * Soft token budget for the assembled context string.
 * Approximate: ~1 token per 4 characters for English markdown text.
 */
const TOKEN_BUDGET = 2000;
const CHARS_PER_TOKEN = 4;
const CHAR_BUDGET = TOKEN_BUDGET * CHARS_PER_TOKEN; // ~8000

// ─── ContentStripper ────────────────────────────────────────────────────

export class ContentStripper {
  private ruleMapper: RuleMapper;

  constructor(ruleMapper?: RuleMapper) {
    this.ruleMapper = ruleMapper ?? getRuleMapper();
  }

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Assemble a compressed markdown context string for a given agent and task.
   *
   * Process:
   * 1. Query RuleMapper for files matching the agent type and task type
   * 2. Read each file and add its content to a single markdown string
   * 3. Prioritize files by relevance: 'all'-tagged files first, then by
   *    number of tags matching the agent's relevant tags
   * 4. Stop adding files when the character budget (~8000 chars / ~2000 tokens)
   *    is exceeded
   * 5. Return the assembled string
   */
  assembleContext(agentType: string, taskType: string = 'default'): string {
    const filePaths = this.ruleMapper.getFilesForTask(agentType, taskType);

    if (filePaths.length === 0) {
      return '_No rule context available._';
    }

    // Rank files: 'all' tagged files first, then by tag match relevance
    const ranked = this.rankFiles(filePaths, agentType);

    const parts: string[] = [];
    let charCount = 0;

    for (const filePath of ranked) {
      const content = this.readFileContent(filePath);
      if (!content) continue;

      // Build entry: file path header + full content
      const relativePath = this.toRelativePath(filePath);
      const entry = `### ${relativePath}\n\n${content}\n\n---\n\n`;
      const entryChars = entry.length;

      // Budget check: add if within budget, stop if exceeded
      if (charCount + entryChars > CHAR_BUDGET && parts.length > 0) {
        // We already have at least one file; stop here
        break;
      }

      parts.push(entry);
      charCount += entryChars;
    }

    if (parts.length === 0) {
      return '_No rule context available._';
    }

    const header = `## Rule Context (${agentType})\n\n`;
    return header + parts.join('');
  }

  // ─── Private ────────────────────────────────────────────────────

  /**
   * Rank files by relevance:
   * 1. Files whose tags include 'all' (universal rules)
   * 2. Then sort by number of tags matching the agent's relevant tags (descending)
   */
  private rankFiles(filePaths: string[], agentType: string): string[] {
    const entries = this.ruleMapper
      .getAllEntries()
      .filter((e) => filePaths.includes(e.path));

    const relevantTags = this.getAgentTags(agentType);

    entries.sort((a, b) => {
      // 'all'-tagged files first
      const aAll = a.tags.includes('all') ? 1 : 0;
      const bAll = b.tags.includes('all') ? 1 : 0;
      if (aAll !== bAll) return bAll - aAll;

      // Then by number of matching tags (descending)
      const aMatch = a.tags.filter((t) => relevantTags.includes(t)).length;
      const bMatch = b.tags.filter((t) => relevantTags.includes(t)).length;
      return bMatch - aMatch;
    });

    return entries.map((e) => e.path);
  }

  /**
   * Get the tag list for an agent from the AGENT_TAG_MAP.
   * Falls back to empty array for unknown agents.
   */
  private getAgentTags(agentType: string): string[] {
    // Inline minimal tag map to avoid circular dependency
    const tagMap: Record<string, string[]> = {
      code: ['backend', 'coding', 'testing', 'database', 'infra', 'devops'],
      plan: ['__all__'],
      architect: ['__all__'],
      pre_verify: ['__all__'],
      post_verify: ['__all__'],
      router: ['__all__'],
    };
    return tagMap[agentType] ?? [];
  }

  /**
   * Read full file content, stripping only the @lifecycle and @tags header
   * lines (they are metadata, not context).
   */
  private readFileContent(filePath: string): string | null {
    try {
      if (!fs.existsSync(filePath)) return null;

      const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

      // Remove @lifecycle and @tags header lines
      const filtered = lines.filter((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith('/* @lifecycle') && !trimmed.startsWith('/* @tags');
      });

      return filtered.join('\n').trim();
    } catch {
      return null;
    }
  }

  /**
   * Convert an absolute path to a relative path for display.
   */
  private toRelativePath(absolutePath: string): string {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const relative = path.relative(projectRoot, absolutePath);
    return relative.startsWith('.') ? relative : `./${relative}`;
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────

let contentStripperInstance: ContentStripper | null = null;

/**
 * Get or create the singleton ContentStripper instance.
 */
export function getContentStripper(): ContentStripper {
  if (!contentStripperInstance) {
    contentStripperInstance = new ContentStripper();
  }
  return contentStripperInstance;
}

/**
 * Reset the ContentStripper singleton (for testing).
 */
export function resetContentStripper(): void {
  contentStripperInstance = null;
}
