/* @lifecycle ACTIVE — Working Memory type definitions (ADR-011, TASK-035, TASK-036) */

/**
 * Agents tracked in working memory.
 * Excludes 'human' and null from the execution DGA — only automated agents
 * performing work are recorded.
 */
export type WorkingMemoryAgent =
  | 'router'
  | 'plan'
  | 'architect'
  | 'code'
  | 'pre_verify'
  | 'post_verify'
  | 'debug';

/**
 * Type of action taken by an agent.
 */
export type WorkingMemoryAction = 'read' | 'modify' | 'create' | 'delete';

/**
 * A single working memory entry — one atomic action by an agent.
 */
export interface WorkingMemoryEntry {
  /** ISO-8601 timestamp of when the action occurred. */
  timestamp: string;
  /** The agent that performed the action. */
  agent: WorkingMemoryAgent;
  /** Relative path from project root to the file(s) affected. 'N/A' if not applicable. */
  file_path: string;
  /** The type of action performed. */
  action_taken: WorkingMemoryAction;
  /** 1-2 sentence summary of what was done. */
  brief_summary: string;
  /** 0 or 1; present only during a retry scenario. */
  retry_attempt?: number;
}

/**
 * A single hop checkpoint — one agent handoff in the execution DGA.
 * Hop IDs match execution-state.json hop_count.
 */
export interface HopEntry {
  /** Monotonically increasing hop ID matching execution-state.json hop_count. */
  hop_id: number;
  /** The agent that completed this hop. */
  agent: WorkingMemoryAgent;
  /** Brief description of what this hop accomplished. */
  result: string;
  /** Snapshot of total WorkingMemoryEntry count at this hop. */
  entries_snapshot: number;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

/**
 * Full working memory state persisted to .kilo/context/working-memory.json.
 */
export interface WorkingMemoryState {
  /** UUID v7 execution identifier, matches ExecutionLock.execution_id. */
  execution_id: string;
  /** Ordered list of entries (most recent last). */
  entries: WorkingMemoryEntry[];
  /** Ordered list of hop checkpoints (most recent last). */
  checkpoints: HopEntry[];
  /** Running compressed summary of the execution so far. */
  compressed_summary: string;
  /** ISO-8601 creation time. */
  created_at: string;
  /** ISO-8601 last update time. */
  updated_at: string;
}

// ─── Delta Types ─────────────────────────────────────────────────────

/**
 * Request payload for getDelta().
 */
export interface DeltaRequest {
  /** The agent requesting the delta. */
  agent_id: string;
  /** Hop ID to diff from. 0 means return everything since start. */
  since_hop_id: number;
}

/**
 * State diff — comparison between WorkingMemoryState at last hop vs current.
 */
export interface StateDiff {
  /** Running compressed summary at current state (not diff). */
  compressed_summary: string;
  /** New WorkingMemoryEntries appended since since_hop_id. */
  new_entries: WorkingMemoryEntry[];
  /** Total WorkingMemoryEntry count at current state. */
  total_entries: number;
}

/**
 * Event diff — new compressed hop events since since_hop_id.
 */
export interface EventDiffEntry {
  /** Hop ID of the event. */
  hop_id: number;
  /** Agent that completed the hop. */
  agent: WorkingMemoryAgent;
  /** Result summary of the hop. */
  result: string;
  /** Total entry count at this hop (snapshot). */
  entry_count: number;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

/**
 * Policy diff — baseline policy changes (deferred; always empty for now).
 */
export interface PolicyDiffEntry {
  /** Policy file path. */
  policy: string;
  /** Description of the change. */
  change: string;
  /** Reference to the source contract section. */
  ref: string;
}

/**
 * Response from getDelta() — contains only the diff, never the full state.
 */
export interface DeltaResponse {
  /** The agent that requested the delta. */
  agent_id: string;
  /** Hop ID the diff was computed from. */
  since_hop_id: number;
  /** Current hop ID at time of response. */
  current_hop_id: number;
  /** State diff (entries added since since_hop_id). */
  state_diff: StateDiff;
  /** Event diff (hop checkpoints since since_hop_id). */
  event_diff: EventDiffEntry[];
  /** Policy diff (deferred — always empty in v1). */
  policy_diff: PolicyDiffEntry[];
}
