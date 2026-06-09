/* @lifecycle ACTIVE — Working Memory type definitions (ADR-011, TASK-035) */

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
  | 'post_verify';

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
 * Full working memory state persisted to .kilo/context/working-memory.json.
 */
export interface WorkingMemoryState {
  /** UUID v7 execution identifier, matches ExecutionLock.execution_id. */
  execution_id: string;
  /** Ordered list of entries (most recent last). */
  entries: WorkingMemoryEntry[];
  /** ISO-8601 creation time. */
  created_at: string;
  /** ISO-8601 last update time. */
  updated_at: string;
}
