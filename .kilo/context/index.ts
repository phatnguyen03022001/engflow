/* @lifecycle ACTIVE — Working Memory Service: persist, retrieve, and summarize agent actions (ADR-011, TASK-035) */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  WorkingMemoryEntry,
  WorkingMemoryAgent,
  WorkingMemoryState,
  HopEntry,
  DeltaRequest,
  DeltaResponse,
  StateDiff,
  EventDiffEntry,
} from './types';
import type { EventPipelineResult } from './events/types';

// ─── Benchmark Types ──────────────────────────────────────────────────

export interface BenchmarkDeltaEntry {
  agent: string;
  since_hop: number;
  formatted_chars: number;
  entry_count: number;
  hop_count: number;
}

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
    checkpoints: [],
    compressed_summary: '',
    created_at: now,
    updated_at: now,
  };
}

// ─── WorkingMemoryService ──────────────────────────────────────────────

export class WorkingMemoryService {
  private state: WorkingMemoryState | null = null;
  /** Delta metrics recorded when KILO_BENCHMARK=1 (accumulated across getDeltaFormatted calls). */
  private _deltaMetrics: BenchmarkDeltaEntry[] = [];

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Return a copy of the accumulated delta benchmark metrics.
   */
  getDeltaMetrics(): BenchmarkDeltaEntry[] {
    return [...this._deltaMetrics];
  }

  /**
   * Load working memory for the given execution_id.
   * If the persisted file matches the execution_id, return it.
   * Otherwise, create a fresh state (e.g. on new REQUEST).
   */
  load(execution_id: string): WorkingMemoryState {
    const persisted = this.readState();

    if (persisted && persisted.execution_id === execution_id) {
      // Backward compatibility: ensure delta fields exist on old state files
      if (!persisted.checkpoints) persisted.checkpoints = [];
      if (!persisted.compressed_summary) persisted.compressed_summary = '';
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

  /**
   * Record a hop checkpoint in working memory.
   *
   * Creates a new HopEntry with the given agent_id and hop_result,
   * appends it to the checkpoints list, and updates the running
   * compressed_summary. Persists the updated state.
   *
   * @throws If state has not been loaded via load() first.
   */
  commit(agent_id: string, hop_result: string): void {
    const state = this.state;
    if (!state) {
      throw new Error(
        'WorkingMemoryState not loaded. Call load(execution_id) first.',
      );
    }

    const hop_id =
      state.checkpoints.length > 0
        ? state.checkpoints[state.checkpoints.length - 1].hop_id + 1
        : 1;

    const hop: HopEntry = {
      hop_id,
      agent: agent_id as WorkingMemoryAgent,
      result: hop_result,
      entries_snapshot: state.entries.length,
      timestamp: new Date().toISOString(),
    };

    state.checkpoints.push(hop);

    // Update running compressed summary
    const summaryLine = `[hop ${hop_id}] ${agent_id}: ${hop_result}`;
    state.compressed_summary = state.compressed_summary
      ? `${state.compressed_summary}\n${summaryLine}`
      : summaryLine;

    state.updated_at = new Date().toISOString();
    this.writeState(state);
  }

  /**
   * Record compressed pipeline events into working memory.
   *
   * Loads state for the given execution_id (if not already loaded) and
   * appends a WorkingMemoryEntry for each compressed event in the pipeline
   * result. Also appends the compressed summary as a single entry so the
   * full result is visible in agent context.
   *
   * @param executionId  Active execution ID.
   * @param source       Source identifier ("build", "lint", "test").
   * @param result       EventPipelineResult from the compression pipeline.
   */
  commitEvent(executionId: string, source: string, result: EventPipelineResult): void {
    if (!this.state || this.state.execution_id !== executionId) {
      this.load(executionId);
    }

    const state = this.state!;

    // Append a summary entry so the compressed result is visible in agent context
    state.entries.push({
      timestamp: new Date().toISOString(),
      agent: 'code',
      file_path: source,
      action_taken: 'modify',
      brief_summary: `Event compression for ${source}: ${result.events.length} event(s). ${result.summary.substring(0, 200)}`,
    });

    state.updated_at = new Date().toISOString();
    this.writeState(state);
  }

  /**
   * Compute the delta (diff) since the given hop_id.
   *
   * Returns only the diff — never the full state. Three diff categories:
   *   - state_diff:  new WorkingMemoryEntries appended since since_hop_id
   *   - event_diff:  new HopEntry checkpoints since since_hop_id
   *   - policy_diff: always empty in v1 (deferred for hot-swap scenarios)
   *
   * @throws If state has not been loaded via load() first.
   */
  getDelta(agent_id: string, since_hop_id: number): DeltaResponse {
    const state = this.state;
    if (!state) {
      throw new Error(
        'WorkingMemoryState not loaded. Call load(execution_id) first.',
      );
    }

    const current_hop_id =
      state.checkpoints.length > 0
        ? state.checkpoints[state.checkpoints.length - 1].hop_id
        : 0;

    // Find entries_snapshot at the requested hop
    const sinceIndex = state.checkpoints.findIndex(
      (c) => c.hop_id === since_hop_id,
    );
    const sinceEntries =
      sinceIndex >= 0 ? state.checkpoints[sinceIndex].entries_snapshot : 0;

    // New entries since that checkpoint (slice from snapshot index)
    const new_entries = state.entries.slice(sinceEntries);

    // New hops since since_hop_id (or all if since_hop_id === 0)
    const new_hops =
      since_hop_id === 0
        ? state.checkpoints
        : state.checkpoints.filter((c) => c.hop_id > since_hop_id);

    const event_diff: EventDiffEntry[] = new_hops.map((h) => ({
      hop_id: h.hop_id,
      agent: h.agent,
      result: h.result,
      entry_count: h.entries_snapshot,
      timestamp: h.timestamp,
    }));

    return {
      agent_id,
      since_hop_id,
      current_hop_id,
      state_diff: {
        compressed_summary: state.compressed_summary,
        new_entries,
        total_entries: state.entries.length,
      },
      event_diff,
      policy_diff: [], // deferred — only for hot-swap scenarios
    };
  }

  /**
   * Format working memory delta as markdown for agent context.
   * Includes execution_id, compressed summary of all hops, and only
   * entries since the given hop.
   *
   * @param agent   Agent name requesting context (unused, kept for API consistency)
   * @param sinceHop  Hop ID to diff from. 0 = return everything since start.
   */
  getDeltaFormatted(agent: string, sinceHop: number): string {
    const state = this.state;
    if (!state || state.entries.length === 0) {
      const _emptyResult = '## Working Memory Context\n\n_No actions recorded yet._\n';
      if (process.env.KILO_BENCHMARK === '1') {
        this._deltaMetrics.push({
          agent,
          since_hop: sinceHop,
          formatted_chars: _emptyResult.length,
          entry_count: 0,
          hop_count: 0,
        });
      }
      return _emptyResult;
    }

    const delta = this.getDelta(agent, sinceHop);
    const lines: string[] = [];

    lines.push('## Working Memory Context');
    lines.push('');
    lines.push(`**Execution**: \`${state.execution_id}\``);
    lines.push(`**Actions recorded**: ${delta.state_diff.total_entries}`);
    lines.push('');

    // Running summary of all hops (full, not delta)
    if (delta.state_diff.compressed_summary) {
      lines.push('### Session Summary');
      lines.push('');
      lines.push(delta.state_diff.compressed_summary);
      lines.push('');
    }

    // Only new entries since the target hop
    const newEntries = delta.state_diff.new_entries;
    if (newEntries.length > 0) {
      lines.push('### New Entries (since last hop)');
      lines.push('');
      lines.push('| # | Agent | Action | File | Summary |');
      lines.push('|---|-------|--------|------|---------|');

      for (let i = 0; i < newEntries.length; i++) {
        const e = newEntries[i];
        const retryMarker = e.retry_attempt !== undefined ? ' (retry)' : '';
        const summary = e.brief_summary.replace(/\|/g, '\\|');
        const filePath = e.file_path === 'N/A' ? '—' : `\`${e.file_path}\``;
        lines.push(
          `| ${i + 1} | ${e.agent} | ${e.action_taken}${retryMarker} | ${filePath} | ${summary} |`,
        );
      }
      lines.push('');
    }

    lines.push(`**Last update**: ${state.updated_at}`);
    lines.push('');

    const _result = lines.join('\n');
    if (process.env.KILO_BENCHMARK === '1') {
      this._deltaMetrics.push({
        agent,
        since_hop: sinceHop,
        formatted_chars: _result.length,
        entry_count: state.entries.length,
        hop_count: state.checkpoints.length,
      });
    }
    return _result;
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
