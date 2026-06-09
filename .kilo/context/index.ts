/* @lifecycle ACTIVE — Working Memory Service: persist, retrieve, and summarize agent actions (ADR-011, TASK-035) */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  WorkingMemoryEntry,
  WorkingMemoryAgent,
  WorkingMemoryState,
} from './types';

// ─── File Paths ────────────────────────────────────────────────────────

const CONTEXT_DIR = path.resolve(__dirname);
const STATE_FILE = path.resolve(CONTEXT_DIR, 'working-memory.json');
const ARCHIVE_DIR = path.resolve(CONTEXT_DIR, 'archive');

// ─── Defaults ──────────────────────────────────────────────────────────

function createEmptyState(execution_id: string): WorkingMemoryState {
  const now = new Date().toISOString();
  return {
    execution_id,
    entries: [],
    created_at: now,
    updated_at: now,
  };
}

// ─── WorkingMemoryService ──────────────────────────────────────────────

export class WorkingMemoryService {
  private state: WorkingMemoryState | null = null;

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Load working memory for the given execution_id.
   * If the persisted file matches the execution_id, return it.
   * Otherwise, create a fresh state (e.g. on new REQUEST).
   */
  load(execution_id: string): WorkingMemoryState {
    const persisted = this.readState();

    if (persisted && persisted.execution_id === execution_id) {
      this.state = persisted;
      return persisted;
    }

    // File missing, corrupt, or execution_id mismatch → fresh start
    const fresh = createEmptyState(execution_id);
    this.state = fresh;
    this.writeState(fresh);
    return fresh;
  }

  /**
   * Append an entry to the working memory and persist.
   * Automatically loads state for the given execution_id if not already
   * in memory or if the execution_id does not match the cached state.
   */
  appendEntry(execution_id: string, entry: WorkingMemoryEntry): void {
    if (!this.state || this.state.execution_id !== execution_id) {
      this.load(execution_id);
    }

    // Safety check: this.state is guaranteed non-null after load()
    const state = this.state!;
    state.entries.push(entry);
    state.updated_at = new Date().toISOString();
    this.writeState(state);
  }

  /**
   * Generate a markdown-formatted context summary for the next agent's prompt.
   *
   * The context includes:
   * - Execution ID and total action count
   * - Table of all recorded actions (most recent last)
   * - Last update timestamp
   */
  getContextFor(_agent: string): string {
    const state = this.state;
    if (!state || state.entries.length === 0) {
      return '## Working Memory Context\n\n_No actions recorded yet._\n';
    }

    const lines: string[] = [];
    lines.push('## Working Memory Context');
    lines.push('');
    lines.push(`**Execution**: \`${state.execution_id}\``);
    lines.push(`**Actions recorded**: ${state.entries.length}`);
    lines.push('');

    // Table header
    lines.push('| # | Agent | Action | File | Summary |');
    lines.push('|---|-------|--------|------|---------|');

    for (let i = 0; i < state.entries.length; i++) {
      const e = state.entries[i];
      const retryMarker = e.retry_attempt !== undefined ? ' (retry)' : '';
      // Escape pipe characters in summary to prevent markdown table breakage
      const summary = e.brief_summary.replace(/\|/g, '\\|');
      const filePath = e.file_path === 'N/A' ? '—' : `\`${e.file_path}\``;
      lines.push(
        `| ${i + 1} | ${e.agent} | ${e.action_taken}${retryMarker} | ${filePath} | ${summary} |`,
      );
    }

    lines.push('');
    lines.push(`**Last update**: ${state.updated_at}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Clear (reset) working memory for the given execution_id.
   * Deletes the persisted file so the next load() starts fresh.
   */
  clear(execution_id: string): void {
    this.state = null;
    if (fs.existsSync(STATE_FILE)) {
      // Only clear if the file matches the given execution_id
      try {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8').trim();
        if (raw) {
          const parsed = JSON.parse(raw) as WorkingMemoryState;
          if (parsed.execution_id === execution_id) {
            fs.unlinkSync(STATE_FILE);
          }
        }
      } catch {
        // File corrupt or unreadable → delete anyway
        fs.unlinkSync(STATE_FILE);
      }
    }
  }

  /**
   * Archive working memory for the given execution_id.
   * Copies the current state to .kilo/context/archive/{execution_id}.json
   * and then clears the active file.
   * Called automatically on COMMIT transitions.
   */
  archive(execution_id: string): void {
    const state =
      this.state?.execution_id === execution_id
        ? this.state
        : this.readState();

    if (!state || state.execution_id !== execution_id) {
      // Nothing to archive
      return;
    }

    this.ensureArchiveDir();
    const archivePath = path.resolve(ARCHIVE_DIR, `${execution_id}.json`);
    fs.writeFileSync(archivePath, JSON.stringify(state, null, 2) + '\n', 'utf-8');

    // Clear active state
    this.state = null;
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
  }

  // ─── Private ────────────────────────────────────────────────────

  /**
   * Read persisted state from disk, returning null if missing or corrupt.
   */
  private readState(): WorkingMemoryState | null {
    try {
      if (!fs.existsSync(STATE_FILE)) return null;
      const raw = fs.readFileSync(STATE_FILE, 'utf-8').trim();
      if (!raw) return null;
      return JSON.parse(raw) as WorkingMemoryState;
    } catch {
      return null;
    }
  }

  /**
   * Write state to working-memory.json.
   */
  private writeState(state: WorkingMemoryState): void {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  }

  /**
   * Ensure the archive directory exists.
   */
  private ensureArchiveDir(): void {
    if (!fs.existsSync(ARCHIVE_DIR)) {
      fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    }
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────

let workingMemoryInstance: WorkingMemoryService | null = null;

/**
 * Get or create the singleton WorkingMemoryService instance.
 */
export function getWorkingMemory(): WorkingMemoryService {
  if (!workingMemoryInstance) {
    workingMemoryInstance = new WorkingMemoryService();
  }
  return workingMemoryInstance;
}

/**
 * Reset the working memory singleton (for testing).
 */
export function resetWorkingMemory(): void {
  workingMemoryInstance = null;
}
