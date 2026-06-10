/* @lifecycle ACTIVE — Guard Runtime: execution state machine validation, lock management, and audit logging */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  AllowedTransition,
  AuditEntry,
  ExecutionLock,
  ExecutionPhase,
  GuardResult,
  RetryCount,
  Agent,
  NonNullAgent,
} from './types';
import type { WorkingMemoryEntry, WorkingMemoryAgent } from '../context/types';
import type { FragmentRegistryResult } from '../context-compiler/ir/types';
import { getWorkingMemory } from '../context/index';
import { getContentStripper } from '../context/content-stripper';

// ─── Transition Validation Matrix ──────────────────────────────────────

/**
 * 17 allowed transitions per execution.contract.md §2.2.
 */
const ALLOWED_TRANSITIONS: AllowedTransition[] = [
  { from: 'REQUEST', to: 'router', condition: 'Always' },
  { from: 'router', to: 'plan', condition: 'LEVEL_2 or LEVEL_3' },
  { from: 'router', to: 'code', condition: 'LEVEL_1, simple implementation' },
  { from: 'router', to: 'architect', condition: 'LEVEL_3, architecture-only' },
  { from: 'plan', to: 'architect', condition: 'Architecture review needed' },
  { from: 'plan', to: 'pre_verify', condition: 'No architecture issues' },
  { from: 'architect', to: 'plan', condition: 'Revision needed (max 1)' },
  { from: 'architect', to: 'pre_verify', condition: 'Architecture approved' },
  { from: 'pre_verify', to: 'code', condition: 'PASS or FLAG' },
  { from: 'pre_verify', to: 'architect', condition: 'BLOCK' },
  { from: 'code', to: 'post_verify', condition: 'Implementation complete' },
  { from: 'post_verify', to: 'COMMIT', condition: 'PASS or FLAG' },
  { from: 'post_verify', to: 'code', condition: 'FAIL (max 1 retry)' },
  { from: 'post_verify', to: 'debug', condition: 'FAIL after CODE retry exhausted' },
  { from: 'post_verify', to: 'architect', condition: 'BLOCK' },
  { from: 'debug', to: 'post_verify', condition: 'Fix applied, re-verify' },
  { from: 'debug', to: 'architect', condition: 'BLOCK (cannot fix)' },
];

/**
 * Build O(1) lookup map: key = `${from}|${to}`.
 */
const allowedTransitionMap = new Map<string, AllowedTransition>();
for (const t of ALLOWED_TRANSITIONS) {
  allowedTransitionMap.set(`${t.from}|${t.to}`, t);
}

/**
 * 9 forbidden transitions per execution.contract.md §2.3.
 * Uses `${from}|${to}` keys. '*' wildcard matches any 'from' agent.
 */
const FORBIDDEN_TRANSITIONS = new Set<string>([
  '*|plan',           // Any → PLAN after PLAN finalized, no re-planning
  'code|plan',        // CODE → PLAN single-pass execution
  'post_verify|plan', // POST_VERIFY → PLAN execution complete
  'router|router',    // ROUTER → ROUTER no re-routing
  'plan|plan',        // PLAN → PLAN no re-plan loop
  'code|code',        // CODE → CODE no self-loop (except retry from POST_VERIFY)
  'debug|plan',       // DEBUG → PLAN no re-planning after execution
  'debug|code',       // DEBUG → CODE never delegates back to CODE
  'debug|pre_verify', // DEBUG → PRE_VERIFY only PostVerify gates debug output
]);

// ─── Benchmark Types ──────────────────────────────────────────────────

export interface BenchmarkMetrics {
  cache_hits: number;
  cache_misses: number;
  wm_chars: number;
  rule_chars: number;
  total_chars: number;
}

function createEmptyBenchmarkMetrics(): BenchmarkMetrics {
  return {
    cache_hits: 0,
    cache_misses: 0,
    wm_chars: 0,
    rule_chars: 0,
    total_chars: 0,
  };
}

// ─── Retry Limits ──────────────────────────────────────────────────────

const MAX_CODE_RETRY = 1;
const MAX_DEBUG_RETRY = 1;
const MAX_ARCH_PLAN_REVISION = 1;

// ─── File Paths ────────────────────────────────────────────────────────

const GUARD_DIR = path.resolve(__dirname);
const STATE_FILE = path.resolve(GUARD_DIR, '..', 'execution-state.json');
const AUDIT_LOG = path.resolve(GUARD_DIR, 'audit.log');

// ─── Defaults ──────────────────────────────────────────────────────────

const DEFAULT_RETRY: RetryCount = { code: 0, debug: 0, arch_plan_revision: 0 };

function createDefaultLock(): ExecutionLock {
  return {
    execution_id: crypto.randomUUID(),
    state: 'IDLE',
    phase: 'IDLE',
    plan_hash: null,
    current_agent: null,
    hop_count: 0,
    locked: false,
    timestamp: new Date().toISOString(),
    retry_count: { ...DEFAULT_RETRY },
    // routing_level intentionally omitted — starts undefined until Router sets it
  };
}

// ─── Audit Helpers ─────────────────────────────────────────────────────

function ensureAuditLog(): void {
  if (!fs.existsSync(AUDIT_LOG)) {
    const dir = path.dirname(AUDIT_LOG);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(AUDIT_LOG, '', 'utf-8');
  }
}

/**
 * Create an audit entry with telemetry timing.
 * Computes duration_ms from started_at to now.
 */
function createAuditEntry(params: {
  execution_id: string;
  from: string;
  to: string;
  allowed: boolean;
  reason: string;
  hop_count: number;
  retry_count: RetryCount;
  locked: boolean;
  started_at: string;
}): AuditEntry {
  const now = new Date();
  const startedAt = new Date(params.started_at);
  const durationMs = now.getTime() - startedAt.getTime();

  return {
    timestamp: now.toISOString(),
    execution_id: params.execution_id,
    from: params.from as unknown as Agent,
    to: params.to as unknown as Agent,
    allowed: params.allowed,
    reason: params.reason,
    hop_count: params.hop_count,
    retry_count: { ...params.retry_count },
    locked: params.locked,
    started_at: params.started_at,
    duration_ms: Math.max(0, durationMs),
  };
}

function appendAuditEntry(entry: AuditEntry): void {
  ensureAuditLog();
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(AUDIT_LOG, line, 'utf-8');
}

// ─── Condition Matching ────────────────────────────────────────────────

/**
 * Check that the provided condition is compatible with the allowed transition's
 * condition string. Supports 'or' clauses (e.g. "PASS or FLAG" matches either).
 */
function conditionMatches(allowed: AllowedTransition, condition?: string): boolean {
  if (!condition) return true;
  const allowedCond = allowed.condition.toLowerCase();
  const inputCond = condition.toLowerCase().trim();

  if (allowedCond.includes(' or ')) {
    const parts = allowedCond.split(' or ').map((s) => s.trim());
    return parts.some((p) => inputCond.includes(p));
  }

  // Check if the allowed condition text contains the input condition value.
  // e.g. allowed "LEVEL_1, simple implementation" matches input "LEVEL_1".
  return allowedCond.includes(inputCond);
}

// ─── Phase Mapping ─────────────────────────────────────────────────────

const PHASE_MAP: Record<string, ExecutionPhase> = {
  'REQUEST|router': 'ROUTING',
  'router|plan': 'PLANNING',
  'router|code': 'EXECUTING',
  'router|architect': 'ARCH_REVIEWING',
  'plan|architect': 'ARCH_REVIEWING',
  'plan|pre_verify': 'PRE_VERIFYING',
  'architect|plan': 'PLANNING',
  'architect|pre_verify': 'PRE_VERIFYING',
  'pre_verify|code': 'EXECUTING',
  'pre_verify|architect': 'ARCH_REVIEWING',
  'code|post_verify': 'POST_VERIFYING',
  'post_verify|code': 'EXECUTING',
  'post_verify|debug': 'EXECUTING',
  'post_verify|architect': 'ARCH_REVIEWING',
  'post_verify|COMMIT': 'COMMITTED',
  'debug|post_verify': 'POST_VERIFYING',
  'debug|architect': 'ARCH_REVIEWING',
};

const VALID_AGENTS = new Set<string>([
  'router', 'plan', 'architect', 'code', 'debug', 'pre_verify', 'post_verify',
]);

function isAgent(value: string): value is NonNullAgent {
  return VALID_AGENTS.has(value);
}

// ─── GuardService Interface ────────────────────────────────────────────

export interface IGuardService {
  /** Validate whether a transition is allowed without executing it. */
  canTransition(from: string, to: string, condition?: string): GuardResult;
  /** Validate and execute a transition. Updates state, counters, lock, and audit log. */
  transition(from: string, to: string, condition?: string): GuardResult;
  /** Return a copy of the current execution lock state. */
  getState(): ExecutionLock;
  /** Reset execution state (for testing / fresh start). */
  reset(retry?: Partial<RetryCount>): void;
}

// ─── GuardService Implementation ───────────────────────────────────────

export class GuardService implements IGuardService {
  private state: ExecutionLock;
  private audited: boolean;
  /** Session-scoped cache for ContentStripper output. Cleared on COMMIT. */
  private contextCache = new Map<string, string>();
  /** Pre-computed fragments loaded from FragmentRegistry. Loaded once per session. */
  private fragments: FragmentRegistryResult | null = null;
  /** Benchmark counters (accumulated across all HOOK 2 invocations). */
  private _benchmark: BenchmarkMetrics = createEmptyBenchmarkMetrics();

  constructor(initialState?: Partial<ExecutionLock>) {
    this.state = this.loadOrCreate(initialState);
    this.audited = false;
  }

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Validate whether a transition is allowed without mutating state.
   *
   * Checks (in order):
   * 1. Forbidden transitions set
   * 2. Known allowed transitions
   * 3. Condition match (if provided)
   * 4. Retry limits
   * 5. Lock state
   */
  canTransition(from: string, to: string, condition?: string): GuardResult {
    // ── 1. Forbidden transitions ──────────────────────────────────
    const key = `${from}|${to}`;
    if (FORBIDDEN_TRANSITIONS.has(key)) {
      return {
        allowed: false,
        reason: `Forbidden transition: ${from} → ${to} (contract §2.3)`,
        retry_count: { ...this.state.retry_count },
      };
    }

    // Wildcard forbidden: Any → PLAN (after lock activation — plan finalized)
    if (FORBIDDEN_TRANSITIONS.has('*|plan') && to === 'plan' && this.state.locked) {
      return {
        allowed: false,
        reason: `Forbidden transition: ${from} → ${to} — no re-planning after PLAN finalized (contract §2.3)`,
        retry_count: { ...this.state.retry_count },
      };
    }

    // ── 2. Allowed transitions ────────────────────────────────────
    const allowed = allowedTransitionMap.get(key);
    if (!allowed) {
      return {
        allowed: false,
        reason: `Unknown transition: ${from} → ${to} (not in allowed transitions, contract §2.2)`,
        retry_count: { ...this.state.retry_count },
      };
    }

    // ── 3. Condition check ────────────────────────────────────────
    if (condition && !conditionMatches(allowed, condition)) {
      return {
        allowed: false,
        reason: `Condition mismatch for ${from} → ${to}: expected "${allowed.condition}", got "${condition}"`,
        retry_count: { ...this.state.retry_count },
      };
    }

    // ── 4. Retry limits ───────────────────────────────────────────
    if (from === 'post_verify' && to === 'code') {
      if (this.state.retry_count.code >= MAX_CODE_RETRY) {
        return {
          allowed: false,
          reason: `CODE retry limit exceeded (max ${MAX_CODE_RETRY}, current: ${this.state.retry_count.code})`,
          retry_count: { ...this.state.retry_count },
        };
      }
    }

    if (from === 'debug' && to === 'post_verify') {
      if (this.state.retry_count.debug >= MAX_DEBUG_RETRY) {
        return {
          allowed: false,
          reason: `DEBUG retry limit exceeded (max ${MAX_DEBUG_RETRY}, current: ${this.state.retry_count.debug})`,
          retry_count: { ...this.state.retry_count },
        };
      }
    }

    if (from === 'architect' && to === 'plan') {
      if (this.state.retry_count.arch_plan_revision >= MAX_ARCH_PLAN_REVISION) {
        return {
          allowed: false,
          reason: `ARCH → PLAN revision limit exceeded (max ${MAX_ARCH_PLAN_REVISION}, current: ${this.state.retry_count.arch_plan_revision})`,
          retry_count: { ...this.state.retry_count },
        };
      }
    }

    // ── 5. Lock state ─────────────────────────────────────────────
    if (this.state.locked && to === 'plan') {
      return {
        allowed: false,
        reason: 'Cannot transition to PLAN while execution is locked (contract §3.1)',
        retry_count: { ...this.state.retry_count },
      };
    }

    if (this.state.locked && from === 'router') {
      return {
        allowed: false,
        reason: 'ROUTER is disabled while execution is locked (contract §3.1)',
        retry_count: { ...this.state.retry_count },
      };
    }

    // ── Terminal state immutability ───────────────────────────────
    if (this.state.state === 'COMMITTED') {
      return {
        allowed: false,
        reason: 'COMMIT is terminal — no transitions out of COMMITTED state (contract §4.7)',
        retry_count: { ...this.state.retry_count },
      };
    }

    return {
      allowed: true,
      retry_count: { ...this.state.retry_count },
    };
  }

  /**
   * Execute a validated transition. Updates state, retry counters, lock,
   * and appends to the audit log. Persists to execution-state.json.
   *
   * Returns the GuardResult. If the transition is not allowed, it still
   * logs the failed attempt to the audit log before returning.
   */
  transition(from: string, to: string, condition?: string): GuardResult {
    const startedAt = new Date().toISOString();
    const transitionKey = `${from}|${to}`;
    const allowedTransition = allowedTransitionMap.get(transitionKey);
    const check = this.canTransition(from, to, condition);

    if (!check.allowed) {
      // Log the failed attempt with telemetry timing
      appendAuditEntry(createAuditEntry({
        execution_id: this.state.execution_id,
        from: this.normalizeNode(from),
        to: this.normalizeNode(to),
        allowed: false,
        reason: check.reason || 'Unknown',
        hop_count: this.state.hop_count,
        retry_count: { ...this.state.retry_count },
        locked: this.state.locked,
        started_at: startedAt,
      }));
      return check;
    }

    // ── Execute transition ────────────────────────────────────────

    // 1. Update agent
    if (isAgent(to)) {
      this.state.current_agent = to;
    }

    // 2. Increment hop count
    this.state.hop_count += 1;
    this.state.timestamp = new Date().toISOString();

    // 3. Update execution phase
    const phaseKey = `${from}|${to}`;
    const phase = PHASE_MAP[phaseKey];
    if (phase) {
      this.state.phase = phase;
    }

    // 4. Update execution state
    if (to === 'COMMIT') {
      this.state.state = 'COMMITTED';
      this.state.locked = false;
    } else if (to === 'pre_verify' && !this.state.locked) {
      // Lock activates on first transition to pre_verify (exiting planning phase)
      this.state.locked = true;
      this.state.state = 'LOCKED';
    } else if (from === 'router' && to === 'plan') {
      this.state.state = 'PLANNING';
    } else if (from === 'code' && to === 'post_verify') {
      // code → post_verify: move from EXECUTING to VERIFYING
      this.state.state = 'VERIFYING';
    } else if (this.state.state === 'LOCKED' || this.state.state === 'PLANNING') {
      // Execution and verification states during locked phase
      if (to === 'code' || to === 'debug' || to === 'post_verify') {
        this.state.state = 'EXECUTING';
      } else if (to === 'pre_verify' || from === 'pre_verify' || from === 'post_verify') {
        this.state.state = 'VERIFYING';
      } else if (to === 'architect') {
        this.state.state = 'LOCKED'; // still under lock during ARCH review
      }
    }

    // 4a. Capture routing level from Router (only on router→* transitions)
    if (from === 'router' && condition) {
      const level = this.extractRoutingLevel(condition);
      if (level) {
        this.state.routing_level = level;
      }
    }

    // 5. Retry counting
    if (from === 'post_verify' && to === 'code') {
      this.state.retry_count.code += 1;
    }
    if (from === 'debug' && to === 'post_verify') {
      this.state.retry_count.debug += 1;
    }
    if (from === 'architect' && to === 'plan') {
      this.state.retry_count.arch_plan_revision += 1;
    }

    // 6. Persist state
    this.writeState();

    // 7. Audit log with telemetry timing
    appendAuditEntry(createAuditEntry({
      execution_id: this.state.execution_id,
      from: this.normalizeNode(from),
      to: this.normalizeNode(to),
      allowed: true,
      reason: condition || (allowedTransition?.condition ?? 'Allowed'),
      hop_count: this.state.hop_count,
      retry_count: { ...this.state.retry_count },
      locked: this.state.locked,
      started_at: startedAt,
    }));

    // ── HOOK 1 (dehydrate): Record departing agent action ────────
    if (from !== 'REQUEST') {
      const wmAgent = from as WorkingMemoryAgent;
      const wmEntry: WorkingMemoryEntry = {
        timestamp: new Date().toISOString(),
        agent: wmAgent,
        file_path: 'N/A',
        action_taken: this.inferAction(from, to),
        brief_summary: this.inferSummary(from, to, condition),
      };
      getWorkingMemory().appendEntry(this.state.execution_id, wmEntry);
      // Record hop checkpoint so getDelta() can diff since last hop
      getWorkingMemory().commit(from, this.inferSummary(from, to, condition));
    }

    // ── Archive on COMMIT ─────────────────────────────────────────
    if (to === 'COMMIT') {
      getWorkingMemory().archive(this.state.execution_id);
      this.contextCache.clear();
    }

    // ── HOOK 2 (hydrate): Build context for the incoming agent ───
    let workingMemoryContext: string | undefined;
    if (to !== 'COMMIT' && isAgent(to)) {
      const wmContext = getWorkingMemory().getDeltaFormatted(
        to,
        Math.max(0, this.state.hop_count - 1),
      );
      const taskType = this.state.routing_level || 'default';
      const cacheKey = `ctx:${this.state.execution_id}:${to}:${taskType}`;
      let ruleContext = this.contextCache.get(cacheKey);

      // ── Benchmark: cache hit/miss ──────────────────────────────
      const _isBm = process.env.KILO_BENCHMARK === '1';
      if (_isBm) {
        if (ruleContext !== undefined) {
          this._benchmark.cache_hits += 1;
        } else {
          this._benchmark.cache_misses += 1;
        }
      }

      if (!ruleContext) {
        ruleContext = getContentStripper().assembleContext(to, taskType);
        this.contextCache.set(cacheKey, ruleContext);
      }
      workingMemoryContext = wmContext + '\n---\n' + ruleContext;

      // ── Benchmark: wm/rule char counts (pre-fragments) ─────────
      if (_isBm) {
        this._benchmark.wm_chars += wmContext.length;
        this._benchmark.rule_chars += (ruleContext || '').length;
      }

      // Inject pre-computed shared fragments (from FragmentRegistry)
      const fragments = this.loadFragments();
      if (fragments && fragments.fragments.length > 0) {
        const sharedContent = fragments.fragments
          .map(f => f.content)
          .join('\n\n');
        workingMemoryContext = '## Shared Context\n\n' + sharedContent + '\n\n' + workingMemoryContext;
      }

      // ── Benchmark: total chars (post-fragment injection) ──────
      if (_isBm && workingMemoryContext) {
        this._benchmark.total_chars += workingMemoryContext.length;
      }
    }

    return {
      allowed: true,
      retry_count: { ...this.state.retry_count },
      working_memory_context: workingMemoryContext,
    };
  }

  /**
   * Return a copy of the current execution lock state.
   */
  getState(): ExecutionLock {
    return { ...this.state, retry_count: { ...this.state.retry_count } };
  }

  /**
   * Return a copy of the accumulated benchmark metrics.
   * Only meaningful when KILO_BENCHMARK=1 is set.
   */
  getBenchmarkMetrics(): BenchmarkMetrics {
    return { ...this._benchmark };
  }

  /**
   * Reset execution state to default. Optionally override retry counts.
   */
  reset(retry?: Partial<RetryCount>): void {
    this.state = createDefaultLock();
    if (retry) {
      this.state.retry_count = { ...DEFAULT_RETRY, ...retry };
    }
    this._benchmark = createEmptyBenchmarkMetrics();
    this.writeState();
  }

  // ─── Private ────────────────────────────────────────────────────

  private loadOrCreate(initial?: Partial<ExecutionLock>): ExecutionLock {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8').trim();
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            ...createDefaultLock(),
            ...parsed,
            ...initial,
            retry_count: {
              ...DEFAULT_RETRY,
              ...(parsed.retry_count || {}),
              ...(initial?.retry_count || {}),
            },
          };
        }
      }
    } catch {
      // File missing or corrupt → fall through to default
    }
    return { ...createDefaultLock(), ...initial };
  }

  private writeState(): void {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2) + '\n', 'utf-8');
  }

  /**
   * Normalize a transition node label to a string suitable for the audit log.
   */
  private normalizeNode(node: string): string {
    return node.toUpperCase();
  }

  /**
   * Extract routing level (LEVEL_1/2/3) from a Router transition condition.
   * Uses regex to handle formats: "LEVEL_3", "LEVEL_1, simple implementation", etc.
   * Returns empty string when no level is found.
   */
  private extractRoutingLevel(condition: string): string {
    const match = condition.match(/LEVEL_[123]/);
    return match?.[0] ?? '';
  }

  /**
   * Load pre-computed FragmentRegistry output from disk.
   * Cached on first call — subsequent calls return the cached result.
   * Silent fallback if fragments.json is missing (returns null).
   */
  private loadFragments(): FragmentRegistryResult | null {
    if (this.fragments) return this.fragments;
    try {
      const fragPath = path.resolve(__dirname, '../context-compiler/fragments.json');
      if (fs.existsSync(fragPath)) {
        const raw = fs.readFileSync(fragPath, 'utf-8');
        this.fragments = JSON.parse(raw) as FragmentRegistryResult;
      }
    } catch {
      this.fragments = null;
    }
    return this.fragments;
  }

  /**
   * Infer a WorkingMemoryAction from a transition pair.
   *
   * - 'code' → 'modify' (code always modifies the codebase)
   * - 'create'/'delete' are reserved for explicit agent reporting
   * - Default → 'read' (assessment, review, verification)
   */
  private inferAction(from: string, _to: string): 'read' | 'modify' | 'create' | 'delete' {
    if (from === 'code' || from === 'debug') return 'modify';
    return 'read';
  }

  /**
   * Build a brief 1-2 sentence summary of what the departing agent did.
   */
  private inferSummary(from: string, to: string, condition?: string): string {
    const condSuffix = condition ? ` (${condition})` : '';
    if (from === 'router') {
      return `Routed to ${to}${condSuffix}`;
    }
    if (from === 'plan') {
      return to === 'pre_verify'
        ? `Completed planning, passed to pre-verify${condSuffix}`
        : `Requested architecture review${condSuffix}`;
    }
    if (from === 'architect') {
      return to === 'pre_verify'
        ? `Approved architecture${condSuffix}`
        : `Requested plan revision${condSuffix}`;
    }
    if (from === 'pre_verify') {
      return to === 'code'
        ? `Pre-verification passed, routed to code${condSuffix}`
        : `Pre-verification blocked, escalated to architect${condSuffix}`;
    }
    if (from === 'code') {
      return `Implemented feature, passed to post-verify${condSuffix}`;
    }
    if (from === 'post_verify') {
      if (to === 'COMMIT') return `Post-verification passed, committing${condSuffix}`;
      if (to === 'code') return `Post-verification failed, retrying code${condSuffix}`;
      if (to === 'debug') return `Post-verification failed after CODE retry, escalating to debug${condSuffix}`;
      return `Post-verification blocked, escalated to architect${condSuffix}`;
    }
    if (from === 'debug') {
      if (to === 'post_verify') return `Applied debug fix, routed to re-verify${condSuffix}`;
      return `Debug cannot fix, escalated to architect${condSuffix}`;
    }
    return `Transitioned from ${from} to ${to}${condSuffix}`;
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────

let guardInstance: GuardService | null = null;

/**
 * Get or create the singleton GuardService instance.
 * Agents should call this to obtain the guard before transitioning.
 */
export function getGuard(): GuardService {
  if (!guardInstance) {
    guardInstance = new GuardService();
  }
  return guardInstance;
}

/**
 * Reset the guard singleton (for testing).
 */
export function resetGuard(): void {
  guardInstance = null;
}
