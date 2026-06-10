/* @lifecycle ACTIVE — Guard Runtime type definitions for execution state machine (TASK-030b) */

/**
 * Execution state machine states.
 * Maps to the lock schema `state` field.
 */
export type ExecutionState =
  | 'IDLE'
  | 'ROUTING'
  | 'PLANNING'
  | 'LOCKED'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'COMMITTED'
  | 'BLOCKED';

/**
 * Execution phase — finer-grained tracking within states.
 */
export type ExecutionPhase =
  | 'IDLE'
  | 'ROUTING'
  | 'PLANNING'
  | 'ARCH_REVIEWING'
  | 'PRE_VERIFYING'
  | 'EXECUTING'
  | 'POST_VERIFYING'
  | 'COMMITTED'
  | 'BLOCKED';

/**
 * Agents in the execution DAG.
 */
export type Agent =
  | 'router'
  | 'plan'
  | 'architect'
  | 'code'
  | 'debug'
  | 'pre_verify'
  | 'post_verify'
  | 'human'
  | null;

/** Non-null agent type for discriminants. */
export type NonNullAgent = NonNullable<Agent>;

/**
 * Retry counters — tracks retries per scenario.
 */
export interface RetryCount {
  /** CODE → POST_VERIFY FAIL retries (max 1) */
  code: number;
  /** DEBUG → POST_VERIFY retries (max 1) */
  debug: number;
  /** ARCH → PLAN revision retries (max 1) */
  arch_plan_revision: number;
}

/**
 * Execution lock schema — persisted to execution-state.json.
 */
export interface ExecutionLock {
  execution_id: string;
  state: ExecutionState;
  phase: ExecutionPhase;
  plan_hash: string | null;
  current_agent: Agent;
  hop_count: number;
  locked: boolean;
  timestamp: string; // ISO-8601
  retry_count: RetryCount;
  /** Captured from Router's LEVEL_X classification. Undefined until Router runs. */
  routing_level?: string;
}

/**
 * A single transition between two agents/states.
 */
export interface Transition {
  from: Agent;
  to: Agent;
  condition?: string;
  timestamp?: string;
}

/**
 * Result of a guard validation check.
 */
export interface GuardResult {
  allowed: boolean;
  reason?: string;
  retry_count?: RetryCount;
  /** Markdown context from WorkingMemory for the next agent's prompt. */
  working_memory_context?: string;
}

/**
 * Audit log entry — appended to audit.log on each transition.
 * Includes telemetry timing for duration tracking.
 */
export interface AuditEntry {
  timestamp: string;
  execution_id: string;
  from: Agent;
  to: Agent;
  allowed: boolean;
  reason: string;
  hop_count: number;
  retry_count: RetryCount;
  locked: boolean;
  /** When the transition started processing (ISO-8601). */
  started_at: string;
  /** Duration of transition processing in milliseconds. */
  duration_ms: number;
}

/**
 * Decision from PRE_VERIFY / POST_VERIFY gates.
 */
export type GateDecision = 'PASS' | 'FLAG' | 'FAIL' | 'BLOCK';

// ─── Discriminated Union for AllowedTransition ──────────────────────────

/**
 * Base properties shared by all transition variants.
 */
interface BaseAllowedTransition {
  condition: string;
}

/**
 * Discriminated union of all 17 allowed transitions (execution.contract.md §2.2).
 * Each variant encodes the exact `from` → `to` pair as literal types,
 * enabling TypeScript exhaustiveness checks and narrowing.
 */
export type AllowedTransition =
  // REQUEST → router
  | (BaseAllowedTransition & { from: 'REQUEST'; to: 'router'; condition: 'Always' })

  // router → *
  | (BaseAllowedTransition & { from: 'router'; to: 'plan'; condition: 'LEVEL_2 or LEVEL_3' })
  | (BaseAllowedTransition & { from: 'router'; to: 'code'; condition: 'LEVEL_1, simple implementation' })
  | (BaseAllowedTransition & { from: 'router'; to: 'architect'; condition: 'LEVEL_3, architecture-only' })

  // plan → *
  | (BaseAllowedTransition & { from: 'plan'; to: 'architect'; condition: 'Architecture review needed' })
  | (BaseAllowedTransition & { from: 'plan'; to: 'pre_verify'; condition: 'No architecture issues' })

  // architect → *
  | (BaseAllowedTransition & { from: 'architect'; to: 'plan'; condition: 'Revision needed (max 1)' })
  | (BaseAllowedTransition & { from: 'architect'; to: 'pre_verify'; condition: 'Architecture approved' })

  // pre_verify → *
  | (BaseAllowedTransition & { from: 'pre_verify'; to: 'code'; condition: 'PASS or FLAG' })
  | (BaseAllowedTransition & { from: 'pre_verify'; to: 'architect'; condition: 'BLOCK' })

  // code → *
  | (BaseAllowedTransition & { from: 'code'; to: 'post_verify'; condition: 'Implementation complete' })

  // post_verify → *
  | (BaseAllowedTransition & { from: 'post_verify'; to: 'COMMIT'; condition: 'PASS or FLAG' })
  | (BaseAllowedTransition & { from: 'post_verify'; to: 'code'; condition: 'FAIL (max 1 retry)' })
  | (BaseAllowedTransition & { from: 'post_verify'; to: 'debug'; condition: 'FAIL after CODE retry exhausted' })
  | (BaseAllowedTransition & { from: 'post_verify'; to: 'architect'; condition: 'BLOCK' })

  // debug → *
  | (BaseAllowedTransition & { from: 'debug'; to: 'post_verify'; condition: 'Fix applied, re-verify' })
  | (BaseAllowedTransition & { from: 'debug'; to: 'architect'; condition: 'BLOCK (cannot fix)' });
