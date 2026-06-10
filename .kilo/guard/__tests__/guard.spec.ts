/* @lifecycle ACTIVE — Unit tests for Guard Runtime state machine (TASK-030b) */

import { GuardService, IGuardService, resetGuard } from '../index';
import { getWorkingMemory, resetWorkingMemory } from '../../context/index';

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Creates a fresh GuardService with default (IDLE) state.
 * Resets both singleton and any persisted state file for hermetic tests.
 */
function createGuard(): IGuardService {
  resetGuard();
  const { GuardService } = jest.requireActual('../index');
  const g = new GuardService();
  g.reset(); // Ensure clean IDLE state regardless of persisted execution-state.json
  return g;
}

/**
 * Helper to assert a transition is allowed and executes successfully.
 */
function assertAllowed(
  guard: IGuardService,
  from: string,
  to: string,
  condition?: string,
  expectedRetry?: { code?: number; arch_plan_revision?: number },
) {
  const result = guard.transition(from, to, condition);
  expect(result.allowed).toBe(true);
  if (expectedRetry) {
    if (expectedRetry.code !== undefined) {
      expect(result.retry_count?.code).toBe(expectedRetry.code);
    }
    if (expectedRetry.arch_plan_revision !== undefined) {
      expect(result.retry_count?.arch_plan_revision).toBe(
        expectedRetry.arch_plan_revision,
      );
    }
  }
  return result;
}

/**
 * Helper to assert a transition is denied (not allowed).
 */
function assertDenied(
  guard: IGuardService,
  from: string,
  to: string,
  condition?: string,
) {
  const result = guard.canTransition(from, to, condition);
  expect(result.allowed).toBe(false);
  expect(result.reason).toBeDefined();
  return result;
}

/**
 * Helper to assert a transition is denied via the transition() method.
 */
function assertTransitionDenied(
  guard: IGuardService,
  from: string,
  to: string,
  condition?: string,
) {
  const result = guard.transition(from, to, condition);
  expect(result.allowed).toBe(false);
  expect(result.reason).toBeDefined();
  return result;
}

// ─── Suite ──────────────────────────────────────────────────────────────

describe('GuardService', () => {
  let guard: IGuardService;

  beforeEach(() => {
    guard = createGuard();
  });

  afterEach(() => {
    resetGuard();
    resetWorkingMemory();
  });

  describe('initial state', () => {
    it('should start in IDLE state', () => {
      const state = guard.getState();
      expect(state.state).toBe('IDLE');
      expect(state.phase).toBe('IDLE');
      expect(state.current_agent).toBeNull();
      expect(state.hop_count).toBe(0);
      expect(state.locked).toBe(false);
      expect(state.retry_count.code).toBe(0);
      expect(state.retry_count.debug).toBe(0);
      expect(state.retry_count.arch_plan_revision).toBe(0);
    });

    it('should accept initial partial state override', () => {
      resetGuard();
      const customGuard = new GuardService({
        execution_id: 'custom-id',
      });
      expect(customGuard.getState().execution_id).toBe('custom-id');
    });
  });

  describe('routing level persistence', () => {
    it('should persist routing level across non-router hops', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan', 'LEVEL_3');
      expect(guard.getState().routing_level).toBe('LEVEL_3');

      guard.transition('plan', 'architect');
      expect(guard.getState().routing_level).toBe('LEVEL_3');

      guard.transition('architect', 'pre_verify', 'Architecture approved');
      expect(guard.getState().routing_level).toBe('LEVEL_3');

      guard.transition('pre_verify', 'code', 'PASS');
      expect(guard.getState().routing_level).toBe('LEVEL_3');

      guard.transition('code', 'post_verify');
      expect(guard.getState().routing_level).toBe('LEVEL_3');
    });

    it('should be undefined on fresh guard before Router runs', () => {
      const freshGuard = createGuard();
      expect(freshGuard.getState().routing_level).toBeUndefined();
    });

    it('should not allow non-router agents to overwrite routing_level', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan', 'LEVEL_2');
      expect(guard.getState().routing_level).toBe('LEVEL_2');

      guard.transition('plan', 'pre_verify', 'No architecture issues');
      expect(guard.getState().routing_level).toBe('LEVEL_2');

      guard.transition('pre_verify', 'code', 'PASS');
      expect(guard.getState().routing_level).toBe('LEVEL_2');
    });
  });

  describe('working memory delta', () => {
    it('should return only new entries after checkpoint', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan', 'LEVEL_3');
      guard.transition('plan', 'architect');

      // After 3 transitions, delta from hop 1 gives entries added since hop 1
      // (the plan entry at transition 3, which was committed inside hop 2's checkpoint)
      const delta = getWorkingMemory().getDelta('architect', 1);
      expect(delta.state_diff.new_entries).toHaveLength(1);
    });

    it('should include execution_id in formatted output', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan', 'LEVEL_3');

      const formatted = getWorkingMemory().getDeltaFormatted('plan', 1);
      expect(formatted).toContain('**Execution**');
      expect(formatted).toContain('**Actions recorded**');
    });

    it('should include compressed summary with full history', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan', 'LEVEL_3');
      guard.transition('plan', 'pre_verify', 'No architecture issues');

      const formatted = getWorkingMemory().getDeltaFormatted('pre_verify', 2);
      expect(formatted).toContain('### Session Summary');
      expect(formatted).toContain('[hop 1]');
      expect(formatted).toContain('[hop 2]');
    });

    it('should show empty context for first hop before any entry is recorded', () => {
      guard.transition('REQUEST', 'router');

      // HOOK 1 skipped for REQUEST → no entries. getDeltaFormatted handles null state.
      const formatted = getWorkingMemory().getDeltaFormatted('router', 0);
      expect(formatted).toContain('No actions recorded yet');
    });
  });

  // ─── 14 Valid Transitions (§2.2) ──────────────────────────────────────

  describe('14 valid transitions (contract §2.2)', () => {
    it('1. REQUEST → router (Always)', () => {
      assertAllowed(guard, 'REQUEST', 'router');
      const state = guard.getState();
      expect(state.current_agent).toBe('router');
      expect(state.hop_count).toBe(1);
    });

    it('2. router → plan (LEVEL_2 or LEVEL_3)', () => {
      guard.transition('REQUEST', 'router');
      assertAllowed(guard, 'router', 'plan', 'LEVEL_3');
      expect(guard.getState().state).toBe('PLANNING');
    });

    it('3. router → code (LEVEL_1, simple implementation)', () => {
      guard.transition('REQUEST', 'router');
      assertAllowed(guard, 'router', 'code', 'LEVEL_1');
    });

    it('4. router → architect (LEVEL_3, architecture-only)', () => {
      guard.transition('REQUEST', 'router');
      assertAllowed(guard, 'router', 'architect', 'LEVEL_3');
    });

    it('5. plan → architect (Architecture review needed)', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      assertAllowed(guard, 'plan', 'architect');
    });

    it('6. plan → pre_verify (No architecture issues)', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      assertAllowed(guard, 'plan', 'pre_verify');
      // Lock activates on plan → pre_verify
      expect(guard.getState().locked).toBe(true);
      expect(guard.getState().state).toBe('LOCKED');
    });

    it('7. architect → plan (Revision needed, max 1)', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'architect');
      assertAllowed(guard, 'architect', 'plan');
      expect(guard.getState().retry_count.arch_plan_revision).toBe(1);
    });

    it('8. architect → pre_verify (Architecture approved)', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'architect');
      assertAllowed(guard, 'architect', 'pre_verify');
    });

    it('9. pre_verify → code (PASS or FLAG)', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      assertAllowed(guard, 'pre_verify', 'code', 'PASS');
      expect(guard.getState().state).toBe('EXECUTING');
    });

    it('10. pre_verify → architect (BLOCK)', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      assertAllowed(guard, 'pre_verify', 'architect', 'BLOCK');
    });

    it('11. code → post_verify (Implementation complete)', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      assertAllowed(guard, 'code', 'post_verify');
      expect(guard.getState().state).toBe('VERIFYING');
    });

    it('12. post_verify → COMMIT (PASS or FLAG)', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');
      assertAllowed(guard, 'post_verify', 'COMMIT', 'PASS');
      expect(guard.getState().state).toBe('COMMITTED');
      expect(guard.getState().locked).toBe(false);
    });

    it('13. post_verify → code (FAIL, max 1 retry)', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');
      assertAllowed(guard, 'post_verify', 'code', 'FAIL');
      expect(guard.getState().retry_count.code).toBe(1);
    });

    it('14. post_verify → architect (BLOCK)', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');
      assertAllowed(guard, 'post_verify', 'architect', 'BLOCK');
    });
  });

  // ─── Full Happy Path ───────────────────────────────────────────────────

  describe('full happy path execution', () => {
    it('should complete a full LEVEL_3 execution flow', () => {
      guard.transition('REQUEST', 'router');
      expect(guard.getState().hop_count).toBe(1);

      guard.transition('router', 'plan', 'LEVEL_3');
      expect(guard.getState().hop_count).toBe(2);
      expect(guard.getState().state).toBe('PLANNING');

      guard.transition('plan', 'architect');
      expect(guard.getState().hop_count).toBe(3);

      guard.transition('architect', 'pre_verify', 'Architecture approved');
      expect(guard.getState().hop_count).toBe(4);

      guard.transition('pre_verify', 'code', 'PASS');
      expect(guard.getState().hop_count).toBe(5);
      expect(guard.getState().locked).toBe(true);

      guard.transition('code', 'post_verify');
      expect(guard.getState().hop_count).toBe(6);

      guard.transition('post_verify', 'COMMIT', 'PASS');
      expect(guard.getState().hop_count).toBe(7);
      expect(guard.getState().state).toBe('COMMITTED');
      expect(guard.getState().locked).toBe(false);
    });
  });

  // ─── 6 Forbidden Transitions (§2.3) ───────────────────────────────────

  describe('6 forbidden transitions (contract §2.3)', () => {
    beforeEach(() => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify'); // Lock activates
    });

    it('1. Any → PLAN — no re-planning after PLAN finalized', () => {
      // After lock activation (plan → pre_verify), any transition to plan is forbidden
      // Try from ARCH state
      guard.transition('pre_verify', 'architect', 'BLOCK');
      assertDenied(guard, 'architect', 'plan');
    });

    it('2. CODE → PLAN — single-pass execution', () => {
      assertDenied(guard, 'code', 'plan');
    });

    it('3. POST_VERIFY → PLAN — execution complete', () => {
      assertDenied(guard, 'post_verify', 'plan');
    });

    it('4. ROUTER → ROUTER — no re-routing', () => {
      resetGuard();
      guard = createGuard(); // fresh state
      assertDenied(guard, 'router', 'router');
    });

    it('5. PLAN → PLAN — no re-plan loop', () => {
      resetGuard();
      guard = createGuard();
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      assertDenied(guard, 'plan', 'plan');
    });

    it('6. CODE → CODE — no self-loop', () => {
      assertDenied(guard, 'code', 'code');
    });
  });

  // ─── Condition Matching ───────────────────────────────────────────────

  describe('condition matching', () => {
    beforeEach(() => {
      guard.transition('REQUEST', 'router');
    });

    it('should allow transition with matching condition', () => {
      expect(guard.canTransition('router', 'plan', 'LEVEL_3').allowed).toBe(
        true,
      );
    });

    it('should deny transition with non-matching condition', () => {
      const result = guard.canTransition('router', 'plan', 'LEVEL_1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Condition mismatch');
    });

    it('should allow transition without condition when one is not required', () => {
      // router → code condition "LEVEL_1, simple implementation" matches input "LEVEL_1"
      expect(guard.canTransition('router', 'code', 'LEVEL_1').allowed).toBe(
        true,
      );
    });

    it('should handle "or" conditions (PASS or FLAG)', () => {
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      expect(guard.canTransition('pre_verify', 'code', 'PASS').allowed).toBe(
        true,
      );
      expect(guard.canTransition('pre_verify', 'code', 'FLAG').allowed).toBe(
        true,
      );
    });

    it('should reject non-matching "or" condition variant', () => {
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      const result = guard.canTransition('pre_verify', 'code', 'BLOCK');
      expect(result.allowed).toBe(false);
    });
  });

  // ─── Retry Limits ─────────────────────────────────────────────────────

  describe('retry limits', () => {
    it('should allow CODE retry up to max 1', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');

      // First retry: allowed
      assertAllowed(guard, 'post_verify', 'code', 'FAIL');
      expect(guard.getState().retry_count.code).toBe(1);

      // Second retry: denied (max 1)
      const result = guard.transition('post_verify', 'code', 'FAIL');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('retry limit');
    });

    it('should allow ARCH → PLAN revision up to max 1', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'architect');

      // First revision: allowed
      assertAllowed(guard, 'architect', 'plan');
      expect(guard.getState().retry_count.arch_plan_revision).toBe(1);

      // Second revision: denied (max 1)
      guard.transition('plan', 'architect');
      const result = guard.transition('architect', 'plan');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('revision limit');
    });

    it('should reset retry counts', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');
      guard.transition('post_verify', 'code', 'FAIL');
      expect(guard.getState().retry_count.code).toBe(1);

      guard.reset();
      expect(guard.getState().retry_count.code).toBe(0);
      expect(guard.getState().retry_count.debug).toBe(0);
      expect(guard.getState().retry_count.arch_plan_revision).toBe(0);
    });
  });

  // ─── Lock State ───────────────────────────────────────────────────────

  describe('lock state enforcement', () => {
    it('should activate lock on plan → pre_verify', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      expect(guard.getState().locked).toBe(false);

      guard.transition('plan', 'pre_verify');
      expect(guard.getState().locked).toBe(true);
      expect(guard.getState().state).toBe('LOCKED');
    });

    it('should deny transition to PLAN when locked', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');

      // code → plan is explicitly forbidden in §2.3 (CODE → PLAN single-pass execution)
      const result = guard.canTransition('code', 'plan');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Forbidden transition');
    });

    it('should disable ROUTER when locked', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');

      const result = guard.transition('router', 'code');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('locked');
    });
  });

  // ─── Terminal State ───────────────────────────────────────────────────

  describe('COMMIT terminal state (contract §4.7)', () => {
    it('should not allow any transition after COMMIT', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');
      guard.transition('post_verify', 'COMMIT', 'PASS');

      expect(guard.getState().state).toBe('COMMITTED');

      // Any transition should be denied
      const result = guard.canTransition('router', 'plan');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('terminal');
    });
  });

  // ─── Reset ────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('should reset to default state', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      expect(guard.getState().hop_count).toBe(2);

      guard.reset();
      const state = guard.getState();
      expect(state.state).toBe('IDLE');
      expect(state.hop_count).toBe(0);
      expect(state.current_agent).toBeNull();
    });

    it('should accept partial retry override on reset', () => {
      guard.reset({ code: 1 });
      expect(guard.getState().retry_count.code).toBe(1);
      expect(guard.getState().retry_count.arch_plan_revision).toBe(0);
    });
  });

  // ─── canTransition vs transition ──────────────────────────────────────

  describe('canTransition vs transition', () => {
    it('canTransition should not mutate state', () => {
      guard.transition('REQUEST', 'router');
      const before = guard.getState().hop_count;

      guard.canTransition('router', 'plan', 'LEVEL_2');
      expect(guard.getState().hop_count).toBe(before);
    });

    it('transition should mutate state', () => {
      guard.transition('REQUEST', 'router');
      const before = guard.getState().hop_count;

      guard.transition('router', 'plan', 'LEVEL_2');
      expect(guard.getState().hop_count).toBe(before + 1);
    });

    it('transition should log failed attempts to audit', () => {
      guard.transition('REQUEST', 'router');
      // This should not throw even though it fails
      const result = guard.transition('router', 'router');
      expect(result.allowed).toBe(false);
    });
  });

  // ─── Telemetry Timing ─────────────────────────────────────────────────

  describe('telemetry timing', () => {
    it('transition should capture timing started_at', () => {
      // We can't directly access audit entries from the service,
      // but we can verify that the transition method runs without error
      // and that the state timestamp is updated
      guard.transition('REQUEST', 'router');
      const state = guard.getState();
      expect(state.timestamp).toBeDefined();
      expect(new Date(state.timestamp).getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
    });

    it('should update timestamp on each transition', () => {
      guard.transition('REQUEST', 'router');
      const ts1 = new Date(guard.getState().timestamp).getTime();

      // Small delay to guarantee different timestamp
      const start = Date.now();
      while (Date.now() - start < 5) {} // 5ms delay

      guard.transition('router', 'plan', 'LEVEL_2');
      const ts2 = new Date(guard.getState().timestamp).getTime();

      expect(ts2).toBeGreaterThanOrEqual(ts1);
    });
  });

  // ─── Phase Tracking ──────────────────────────────────────────────────

  describe('phase tracking', () => {
    it('should track ROUTING phase', () => {
      guard.transition('REQUEST', 'router');
      expect(guard.getState().phase).toBe('ROUTING');
    });

    it('should track PRE_VERIFYING phase', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      expect(guard.getState().phase).toBe('PRE_VERIFYING');
    });

    it('should track COMMITTED phase', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');
      guard.transition('post_verify', 'COMMIT', 'PASS');
      expect(guard.getState().phase).toBe('COMMITTED');
    });
  });

  // ─── Hop Counting ────────────────────────────────────────────────────

  describe('hop counting', () => {
    it('should increment hop count on each successful transition', () => {
      guard.transition('REQUEST', 'router');
      expect(guard.getState().hop_count).toBe(1);

      guard.transition('router', 'plan');
      expect(guard.getState().hop_count).toBe(2);

      guard.transition('plan', 'pre_verify');
      expect(guard.getState().hop_count).toBe(3);
    });

    it('should not increment hop count for failed transitions', () => {
      guard.transition('REQUEST', 'router');
      const before = guard.getState().hop_count;

      guard.transition('router', 'router'); // forbidden
      expect(guard.getState().hop_count).toBe(before);
    });
  });

  // ─── Unknown Transitions ─────────────────────────────────────────────

  describe('unknown transitions', () => {
    it('should reject completely unknown transitions', () => {
      const result = guard.canTransition('code', 'router');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unknown transition');
    });

    it('should reject transition to non-existent agent', () => {
      const result = guard.canTransition('router', 'unknown_agent');
      expect(result.allowed).toBe(false);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle BLOCKED flow from pre_verify', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');

      // Pre-verify blocks → architect
      assertAllowed(guard, 'pre_verify', 'architect', 'BLOCK');
      expect(guard.getState().current_agent).toBe('architect');
    });

    it('should handle BLOCKED flow from post_verify', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');

      // Post-verify blocks → architect
      assertAllowed(guard, 'post_verify', 'architect', 'BLOCK');
      expect(guard.getState().current_agent).toBe('architect');
    });

    it('should handle FLAG -> COMMIT flow', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');

      assertAllowed(guard, 'post_verify', 'COMMIT', 'FLAG');
      expect(guard.getState().state).toBe('COMMITTED');
    });
  });

  // ─── 3 DEBUG Transitions (§2.2) ───────────────────────────────────────

  describe('DEBUG transition validation', () => {
    it('1. post_verify → debug (FAIL after CODE retry exhausted)', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');
      assertAllowed(guard, 'post_verify', 'debug', 'FAIL after CODE retry exhausted');
      expect(guard.getState().current_agent).toBe('debug');
    });

    it('2. debug → post_verify (Fix applied, re-verify)', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');
      guard.transition('post_verify', 'debug', 'FAIL after CODE retry exhausted');
      assertAllowed(guard, 'debug', 'post_verify', 'Fix applied, re-verify');
      expect(guard.getState().current_agent).toBe('post_verify');
    });

    it('3. debug → architect (BLOCK (cannot fix))', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');
      guard.transition('post_verify', 'debug', 'FAIL after CODE retry exhausted');
      assertAllowed(guard, 'debug', 'architect', 'BLOCK (cannot fix)');
      expect(guard.getState().current_agent).toBe('architect');
    });
  });

  // ─── 3 DEBUG Forbidden Transitions (§2.3) ─────────────────────────────

  describe('DEBUG forbidden transitions', () => {
    beforeEach(() => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');
      guard.transition('post_verify', 'debug', 'FAIL after CODE retry exhausted');
    });

    it('1. debug → plan — no re-planning after execution', () => {
      assertDenied(guard, 'debug', 'plan');
    });

    it('2. debug → code — never delegates back to CODE', () => {
      assertDenied(guard, 'debug', 'code');
    });

    it('3. debug → pre_verify — only POST_VERIFY gates debug output', () => {
      assertDenied(guard, 'debug', 'pre_verify');
    });
  });

  // ─── DEBUG Retry Limits ───────────────────────────────────────────────

  describe('DEBUG retry limit', () => {
    it('should allow DEBUG → POST_VERIFY once, then deny on second attempt', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');
      guard.transition('post_verify', 'debug', 'FAIL after CODE retry exhausted');

      // First debug → post_verify: allowed
      assertAllowed(guard, 'debug', 'post_verify', 'Fix applied, re-verify');
      expect(guard.getState().retry_count.debug).toBe(1);

      // Second debug → post_verify: denied (max 1)
      const result = guard.transition('debug', 'post_verify', 'Fix applied, re-verify');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('retry limit');
    });

    it('should track debug retry count independently of code retry count', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan');
      guard.transition('plan', 'pre_verify');
      guard.transition('pre_verify', 'code');
      guard.transition('code', 'post_verify');

      // CODE retry
      guard.transition('post_verify', 'code', 'FAIL');
      expect(guard.getState().retry_count.code).toBe(1);

      // CODE → POST_VERIFY again, then FAIL → DEBUG
      guard.transition('code', 'post_verify');
      guard.transition('post_verify', 'debug', 'FAIL after CODE retry exhausted');

      // DEBUG retry
      guard.transition('debug', 'post_verify', 'Fix applied, re-verify');
      expect(guard.getState().retry_count.debug).toBe(1);
      expect(guard.getState().retry_count.code).toBe(1); // unchanged
    });
  });

  // ─── Debug Integrated Happy Path ───────────────────────────────────────

  describe('DEBUG integrated happy path: CODE → POST_VERIFY → CODE → POST_VERIFY → DEBUG → POST_VERIFY → COMMIT', () => {
    it('should complete a full escalation flow through DEBUG', () => {
      // Phase 1: Initial implementation
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan', 'LEVEL_3');
      guard.transition('plan', 'pre_verify', 'No architecture issues');
      guard.transition('pre_verify', 'code', 'PASS');
      guard.transition('code', 'post_verify');
      expect(guard.getState().phase).toBe('POST_VERIFYING');

      // Phase 2: PostVerify FAIL → CODE retry
      guard.transition('post_verify', 'code', 'FAIL');
      expect(guard.getState().retry_count.code).toBe(1);
      expect(guard.getState().current_agent).toBe('code');
      expect(guard.getState().phase).toBe('EXECUTING');

      // Phase 3: CODE retry → PostVerify FAIL again
      guard.transition('code', 'post_verify');
      expect(guard.getState().phase).toBe('POST_VERIFYING');

      // Phase 4: PostVerify FAIL after CODE retry exhausted → DEBUG escalation
      guard.transition('post_verify', 'debug', 'FAIL after CODE retry exhausted');
      expect(guard.getState().current_agent).toBe('debug');
      expect(guard.getState().phase).toBe('EXECUTING');

      // Phase 5: DEBUG fix → PostVerify re-verify
      guard.transition('debug', 'post_verify', 'Fix applied, re-verify');
      expect(guard.getState().retry_count.debug).toBe(1);
      expect(guard.getState().phase).toBe('POST_VERIFYING');

      // Phase 6: PostVerify PASS → COMMIT
      guard.transition('post_verify', 'COMMIT', 'PASS');
      expect(guard.getState().state).toBe('COMMITTED');
      expect(guard.getState().locked).toBe(false);
      expect(guard.getState().hop_count).toBe(10);
    });
  });
});
