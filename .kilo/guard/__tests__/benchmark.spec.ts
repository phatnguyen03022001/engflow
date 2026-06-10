/* @lifecycle ACTIVE — Benchmark snapshot tests: guard HOOK 2, working memory delta, ContentStripper (KILO_BENCHMARK=1) */

import * as fs from 'fs';
import * as path from 'path';
import { GuardService, resetGuard, BenchmarkMetrics } from '../index';
import { getWorkingMemory, resetWorkingMemory } from '../../context/index';
import { getContentStripper, resetContentStripper } from '../../context/content-stripper';

// ─── File Paths for cleanup ────────────────────────────────────────────

const GUARD_STATE_FILE = path.resolve(__dirname, '..', '..', 'execution-state.json');
const WM_STATE_FILE = path.resolve(__dirname, '..', '..', 'context', 'working-memory.json');

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Normalize execution IDs and timestamps in formatted output.
 * Replaces UUIDs with a fixed placeholder and ISO timestamps with '<ts>'.
 */
function normalizeFormatted(text: string): string {
  return text
    .replace(/`[a-f0-9-]{36}`/g, '`bm`')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<ts>');
}

/**
 * Charter-format benchmark table header used for reporting.
 * Builds the table string from accumulated metrics.
 */
function buildCharterTable(
  bm: { cache_hits: number; cache_misses: number; wm_chars: number; rule_chars: number; total_chars: number },
  deltas: Array<{ agent: string; since_hop: number; formatted_chars: number; entry_count: number; hop_count: number }>,
): { table: string; snapshot: Record<string, string | number> } {
  const hitRate =
    bm.cache_hits + bm.cache_misses > 0
      ? ((bm.cache_hits / (bm.cache_hits + bm.cache_misses)) * 100).toFixed(1)
      : 'N/A';

  const firstDelta = deltas[0]?.formatted_chars ?? 0;
  const lastDelta = deltas[deltas.length - 1]?.formatted_chars ?? 0;
  const deltaGrowth = lastDelta - firstDelta;

  const snapshot = {
    wm_chars: bm.wm_chars,
    rule_chars: bm.rule_chars,
    total_chars: bm.total_chars,
    cache_hits: bm.cache_hits,
    cache_misses: bm.cache_misses,
    cache_hit_rate: hitRate,
    delta_entries: deltas.length,
    delta_formatted_chars_first: firstDelta,
    delta_formatted_chars_last: lastDelta,
    delta_growth_chars: deltaGrowth,
  };

  const table = `
## Benchmark Charter Report

| Metric | Value |
|--------|-------|
| wm_chars | ${bm.wm_chars} |
| rule_chars | ${bm.rule_chars} |
| total_chars | ${bm.total_chars} |
| cache_hits | ${bm.cache_hits} |
| cache_misses | ${bm.cache_misses} |
| cache_hit_rate | ${hitRate}% |
| delta_entries | ${deltas.length} |
| delta_formatted_chars_first | ${firstDelta} |
| delta_formatted_chars_last | ${lastDelta} |
| delta_growth_chars | ${deltaGrowth} |
`;

  return { table, snapshot };
}

/**
 * Run a full LEVEL_3 flow through the guard, returning accumulated metrics.
 */
function runFullFlow(guard: GuardService): void {
  guard.transition('REQUEST', 'router');
  guard.transition('router', 'plan', 'LEVEL_3');
  guard.transition('plan', 'architect');
  guard.transition('architect', 'pre_verify', 'Architecture approved');
  guard.transition('pre_verify', 'code', 'PASS');
  guard.transition('code', 'post_verify');
}

// ─── Suite ─────────────────────────────────────────────────────────────

describe('Benchmark: guard HOOK 2 + delta + ContentStripper', () => {
  let guard: GuardService;

  beforeAll(() => {
    process.env.KILO_BENCHMARK = '1';
  });

  afterAll(() => {
    delete process.env.KILO_BENCHMARK;
  });

  beforeEach(() => {
    // Remove persisted state files to ensure hermetic tests
    try { fs.unlinkSync(GUARD_STATE_FILE); } catch { /* ignore */ }
    try { fs.unlinkSync(WM_STATE_FILE); } catch { /* ignore */ }

    resetGuard();
    resetWorkingMemory();
    resetContentStripper();

    guard = new GuardService({ execution_id: 'bm' });
  });

  // ─── Snapshot: getDeltaFormatted() ────────────────────────────────────

  describe('snapshot: getDeltaFormatted()', () => {
    it('should produce empty formatted output on first hop (no entries)', () => {
      guard.transition('REQUEST', 'router');
      const formatted = getWorkingMemory().getDeltaFormatted('router', 0);
      expect(normalizeFormatted(formatted)).toMatchSnapshot();
    });

    it('should produce formatted output with entries after plan hop', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan', 'LEVEL_3');
      const formatted = getWorkingMemory().getDeltaFormatted('plan', 1);
      expect(normalizeFormatted(formatted)).toMatchSnapshot();
    });

    it('should produce full session summary at post_verify hop', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan', 'LEVEL_3');
      guard.transition('plan', 'architect');
      guard.transition('architect', 'pre_verify', 'Architecture approved');
      guard.transition('pre_verify', 'code', 'PASS');
      guard.transition('code', 'post_verify');
      const formatted = getWorkingMemory().getDeltaFormatted('post_verify', 5);
      expect(normalizeFormatted(formatted)).toMatchSnapshot();
    });
  });

  // ─── Snapshot: ContentStripper.assembleContext() ─────────────────────

  describe('snapshot: ContentStripper.assembleContext()', () => {
    it('should produce rule context for code agent (LEVEL_3)', () => {
      const stripper = getContentStripper();
      const context = stripper.assembleContext('code', 'LEVEL_3');
      expect(context).toMatchSnapshot();
    });

    it('should produce rule context for architect agent (LEVEL_3)', () => {
      const stripper = getContentStripper();
      const context = stripper.assembleContext('architect', 'LEVEL_3');
      expect(context).toMatchSnapshot();
    });
  });

  // ─── Snapshot: final workingMemoryContext assembly ────────────────────

  describe('snapshot: final workingMemoryContext assembly', () => {
    it('should produce combined wm + rule context from guard transition', () => {
      guard.transition('REQUEST', 'router');
      guard.transition('router', 'plan', 'LEVEL_3');
      guard.transition('plan', 'architect');
      guard.transition('architect', 'pre_verify', 'Architecture approved');
      guard.transition('pre_verify', 'code', 'PASS');
      const result = guard.transition('code', 'post_verify');
      expect(result.working_memory_context).toBeDefined();
      expect(normalizeFormatted(result.working_memory_context!)).toMatchSnapshot();
    });
  });

  // ─── Benchmark Metrics Collection ────────────────────────────────────

  describe('benchmark metrics collection', () => {
    it('should accumulate cache hit/miss counters', () => {
      runFullFlow(guard);
      const bm = guard.getBenchmarkMetrics();
      // First call per agent is always a miss; repeated agents with same taskType are hits
      expect(bm.cache_hits + bm.cache_misses).toBeGreaterThan(0);
      // With unique agents in the flow, should have at least some misses
      expect(bm.cache_misses).toBeGreaterThan(0);
    });

    it('should accumulate non-zero char counts for wm, rule, and total', () => {
      runFullFlow(guard);
      const bm = guard.getBenchmarkMetrics();
      expect(bm.wm_chars).toBeGreaterThan(0);
      expect(bm.rule_chars).toBeGreaterThan(0);
      expect(bm.total_chars).toBeGreaterThan(0);
      // total_chars must be >= wm_chars (it's the combined assembly)
      expect(bm.total_chars).toBeGreaterThanOrEqual(bm.wm_chars);
    });
  });

  // ─── Delta Growth Metrics ────────────────────────────────────────────

  describe('delta growth metrics', () => {
    it('should record at least one delta entry', () => {
      runFullFlow(guard);
      const deltas = getWorkingMemory().getDeltaMetrics();
      expect(deltas.length).toBeGreaterThan(0);
    });

    it('should show monotonically increasing entry_count', () => {
      runFullFlow(guard);
      const deltas = getWorkingMemory().getDeltaMetrics();
      for (let i = 1; i < deltas.length; i++) {
        expect(deltas[i].entry_count).toBeGreaterThanOrEqual(deltas[i - 1].entry_count);
      }
    });
  });

  // ─── Charter Benchmark Report ────────────────────────────────────────

  describe('charter benchmark report', () => {
    it('should produce and snapshot the charter-format benchmark table', () => {
      runFullFlow(guard);

      const bm = guard.getBenchmarkMetrics();
      const deltas = getWorkingMemory().getDeltaMetrics();

      const { table, snapshot } = buildCharterTable(bm, deltas);

      // Print the charter table to stdout for immediate visibility
      console.log(table);

      // Snapshot the structured metrics object for regression tracking
      expect(snapshot).toMatchSnapshot();
    });
  });

  // ─── Benchmark Flow Scenarios A-D ──────────────────────────────────
  //
  // Per-hop metric collection types
  interface HopMetrics {
    execution_id: string;
    hop: number;
    agent: string;
    routing_level: string;
    wm_chars: number;
    rule_chars: number;
    total_chars: number;
    cache: 'HIT' | 'MISS' | 'N/A';
  }

  interface FlowReport {
    name: string;
    hops: HopMetrics[];
    cacheHits: number;
    cacheMisses: number;
    deltas: Array<{ total_entries: number; new_entries: number; formatted_chars: number }>;
  }

  /**
   * Execute a single transition and extract per-hop metrics by diffing
   * the cumulative benchmark counters before and after.
   */
  function transitionAndCollect(
    guard: GuardService,
    prev: BenchmarkMetrics,
    from: string,
    to: string,
    condition?: string,
  ): { bm: BenchmarkMetrics; hop: HopMetrics; delta: { total_entries: number; new_entries: number; formatted_chars: number } | null } {
    const deltasBefore = getWorkingMemory().getDeltaMetrics().length;

    guard.transition(from, to, condition);

    const bm = guard.getBenchmarkMetrics();
    const state = guard.getState();

    const wmDelta = bm.wm_chars - prev.wm_chars;
    const ruleDelta = bm.rule_chars - prev.rule_chars;
    const totalDelta = bm.total_chars - prev.total_chars;
    const hitDelta = bm.cache_hits - prev.cache_hits;
    const missDelta = bm.cache_misses - prev.cache_misses;

    const cache: 'HIT' | 'MISS' | 'N/A' =
      hitDelta > 0 ? 'HIT' : missDelta > 0 ? 'MISS' : 'N/A';

    const hop: HopMetrics = {
      execution_id: state.execution_id,
      hop: state.hop_count,
      agent: to,
      routing_level: state.routing_level || '',
      wm_chars: wmDelta,
      rule_chars: ruleDelta,
      total_chars: totalDelta,
      cache,
    };

    // Delta metrics: only when a new delta entry was pushed (HOOK 2 fired)
    const deltasAfter = getWorkingMemory().getDeltaMetrics();
    let delta: { total_entries: number; new_entries: number; formatted_chars: number } | null = null;
    if (deltasAfter.length > deltasBefore) {
      const d = deltasAfter[deltasAfter.length - 1];
      const prevEntries = deltasBefore > 0 ? deltasAfter[deltasBefore - 1].entry_count : 0;
      delta = {
        total_entries: d.entry_count,
        new_entries: d.entry_count - prevEntries,
        formatted_chars: d.formatted_chars,
      };
    }

    return { bm, hop, delta };
  }

  function buildPerFlowTable(report: FlowReport): string {
    const lines: string[] = [];
    lines.push(`### Flow ${report.name}`);
    lines.push('');
    lines.push('| Hop | Agent | Level | WM | Rule | Total | Cache |');
    lines.push('|-----|-------|-------|------|------|-------|-------|');
    for (const h of report.hops) {
      lines.push(
        `| ${h.hop} | ${h.agent} | ${h.routing_level} | ${h.wm_chars} | ${h.rule_chars} | ${h.total_chars} | ${h.cache} |`,
      );
    }

    const total = report.cacheHits + report.cacheMisses;
    const hitRate = total > 0 ? ((report.cacheHits / total) * 100).toFixed(1) : 'N/A';
    lines.push('');
    lines.push(`**Cache hits**: ${report.cacheHits}  |  **Cache misses**: ${report.cacheMisses}  |  **Hit rate**: ${hitRate}%`);
    lines.push('');

    // Delta summary
    if (report.deltas.length > 0) {
      lines.push('**Delta metrics per hop**:');
      lines.push('');
      lines.push('| # | total_entries | new_entries | formatted_chars |');
      lines.push('|---|---------------|-------------|-----------------|');
      report.deltas.forEach((d, i) => {
        lines.push(`| ${i + 1} | ${d.total_entries} | ${d.new_entries} | ${d.formatted_chars} |`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  function buildSummaryAcrossFlows(reports: FlowReport[]): string {
    const lines: string[] = [];
    lines.push('## Benchmark Summary');
    lines.push('');
    lines.push('### Cache Statistics');
    lines.push('');
    lines.push('| Flow | Hits | Misses | Hit Rate |');
    lines.push('|------|------|--------|----------|');

    let totalHits = 0;
    let totalMisses = 0;
    for (const r of reports) {
      const t = r.cacheHits + r.cacheMisses;
      const rate = t > 0 ? ((r.cacheHits / t) * 100).toFixed(1) + '%' : 'N/A';
      lines.push(`| ${r.name} | ${r.cacheHits} | ${r.cacheMisses} | ${rate} |`);
      totalHits += r.cacheHits;
      totalMisses += r.cacheMisses;
    }
    const grandTotal = totalHits + totalMisses;
    const grandRate = grandTotal > 0 ? ((totalHits / grandTotal) * 100).toFixed(1) + '%' : 'N/A';
    lines.push(`| **Total** | **${totalHits}** | **${totalMisses}** | **${grandRate}** |`);
    lines.push('');

    // Average context sizes
    lines.push('### Average Context Sizes (chars)');
    lines.push('');
    lines.push('| Flow | Avg WM chars | Avg Rule chars | Avg Total chars |');
    lines.push('|------|-------------|---------------|----------------|');
    for (const r of reports) {
      const n = r.hops.length;
      const avgWm = n > 0 ? (r.hops.reduce((s, h) => s + h.wm_chars, 0) / n).toFixed(1) : 'N/A';
      const avgRule = n > 0 ? (r.hops.reduce((s, h) => s + h.rule_chars, 0) / n).toFixed(1) : 'N/A';
      const avgTotal = n > 0 ? (r.hops.reduce((s, h) => s + h.total_chars, 0) / n).toFixed(1) : 'N/A';
      lines.push(`| ${r.name} | ${avgWm} | ${avgRule} | ${avgTotal} |`);
    }
    lines.push('');

    // Averages grouped by level
    lines.push('### Averages by Complexity Level');
    lines.push('');
    const levels: Record<string, HopMetrics[]> = {};
    for (const r of reports) {
      for (const h of r.hops) {
        const level = h.routing_level || 'none';
        if (!levels[level]) levels[level] = [];
        levels[level].push(h);
      }
    }
    const levelKeys = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'];
    lines.push('| Level | Avg WM chars | Avg Rule chars | Avg Total chars |');
    lines.push('|-------|-------------|---------------|----------------|');
    for (const lk of levelKeys) {
      const hops = levels[lk] || [];
      const n = hops.length;
      if (n > 0) {
        const avgWm = (hops.reduce((s, h) => s + h.wm_chars, 0) / n).toFixed(1);
        const avgRule = (hops.reduce((s, h) => s + h.rule_chars, 0) / n).toFixed(1);
        const avgTotal = (hops.reduce((s, h) => s + h.total_chars, 0) / n).toFixed(1);
        lines.push(`| ${lk} | ${avgWm} | ${avgRule} | ${avgTotal} |`);
      }
    }
    lines.push('');

    return lines.join('\n');
  }

  function runFlow(
    guard: GuardService,
    name: string,
    transitions: Array<{ from: string; to: string; condition?: string }>,
  ): FlowReport {
    const hops: HopMetrics[] = [];
    const deltas: FlowReport['deltas'] = [];
    let bm = guard.getBenchmarkMetrics();

    for (const t of transitions) {
      const result = transitionAndCollect(guard, bm, t.from, t.to, t.condition);
      bm = result.bm;
      hops.push(result.hop);
      if (result.delta) {
        deltas.push(result.delta);
      }
    }

    const cacheHits = hops.filter((h) => h.cache === 'HIT').length;
    const cacheMisses = hops.filter((h) => h.cache === 'MISS').length;

    return { name, hops, cacheHits, cacheMisses, deltas };
  }

  // ─── Flow A: LEVEL_1 ──────────────────────────────────────────────

  describe('Flow A — LEVEL_1', () => {
    it('should collect per-hop metrics for router → code → post_verify → COMMIT', () => {
      const flowGuard = new GuardService({ execution_id: 'bm-flow-a' });
      const report = runFlow(flowGuard, 'A — LEVEL_1', [
        { from: 'REQUEST', to: 'router' },
        { from: 'router', to: 'code', condition: 'LEVEL_1' },
        { from: 'code', to: 'post_verify' },
        { from: 'post_verify', to: 'COMMIT', condition: 'PASS' },
      ]);

      const table = buildPerFlowTable(report);
      console.log(table);
      console.log('---');

      // 4 transitions = 3 hops with HOOK 2 (router, code, post_verify) + COMMIT
      expect(report.hops.length).toBe(4);
      // COMMIT has no HOOK 2 so cache is N/A, wm_chars=0, rule_chars=0, total_chars=0
      const nonCommitHops = report.hops.filter((h) => h.agent !== 'COMMIT');
      expect(nonCommitHops.length).toBe(3);

      // Hops after router should have LEVEL_1 routing_level
      for (const h of nonCommitHops) {
        if (h.agent !== 'router') {
          expect(h.routing_level).toBe('LEVEL_1');
        }
        expect(h.wm_chars).toBeGreaterThanOrEqual(0);
      }
      // No cache hits since all agents unique in this flow
      expect(report.cacheHits).toBe(0);
      expect(report.cacheMisses).toBe(3); // router, code, post_verify
    });
  });

  // ─── Flow B: LEVEL_2 ──────────────────────────────────────────────

  describe('Flow B — LEVEL_2', () => {
    it('should collect per-hop metrics for router → plan → pre_verify → code → post_verify → COMMIT', () => {
      const flowGuard = new GuardService({ execution_id: 'bm-flow-b' });
      const report = runFlow(flowGuard, 'B — LEVEL_2', [
        { from: 'REQUEST', to: 'router' },
        { from: 'router', to: 'plan', condition: 'LEVEL_2' },
        { from: 'plan', to: 'pre_verify', condition: 'No architecture issues' },
        { from: 'pre_verify', to: 'code', condition: 'PASS' },
        { from: 'code', to: 'post_verify' },
        { from: 'post_verify', to: 'COMMIT', condition: 'PASS' },
      ]);

      const table = buildPerFlowTable(report);
      console.log(table);
      console.log('---');

      expect(report.hops.length).toBe(6);
      const nonCommitHops = report.hops.filter((h) => h.agent !== 'COMMIT');
      expect(nonCommitHops.length).toBe(5);

      for (const h of nonCommitHops) {
        if (h.agent !== 'router') {
          expect(h.routing_level).toBe('LEVEL_2');
        }
      }
      expect(report.cacheHits).toBe(0);
      expect(report.cacheMisses).toBe(5);
    });
  });

  // ─── Flow C: LEVEL_3 Retry ────────────────────────────────────────

  describe('Flow C — LEVEL_3 Retry', () => {
    it('should collect per-hop metrics for router → plan → architect → plan → pre_verify → code → post_verify → code → post_verify → COMMIT', () => {
      const flowGuard = new GuardService({ execution_id: 'bm-flow-c' });
      const report = runFlow(flowGuard, 'C — LEVEL_3 Retry', [
        { from: 'REQUEST', to: 'router' },
        { from: 'router', to: 'plan', condition: 'LEVEL_3' },
        { from: 'plan', to: 'architect', condition: 'Architecture review needed' },
        { from: 'architect', to: 'plan', condition: 'Revision needed (max 1)' },
        { from: 'plan', to: 'pre_verify', condition: 'No architecture issues' },
        { from: 'pre_verify', to: 'code', condition: 'PASS' },
        { from: 'code', to: 'post_verify' },
        { from: 'post_verify', to: 'code', condition: 'FAIL (max 1 retry)' },
        { from: 'code', to: 'post_verify' },
        { from: 'post_verify', to: 'COMMIT', condition: 'PASS' },
      ]);

      const table = buildPerFlowTable(report);
      console.log(table);
      console.log('---');

      expect(report.hops.length).toBe(10);
      const nonCommitHops = report.hops.filter((h) => h.agent !== 'COMMIT');
      expect(nonCommitHops.length).toBe(9);

      for (const h of nonCommitHops) {
        if (h.agent !== 'router') {
          expect(h.routing_level).toBe('LEVEL_3');
        }
      }

      // Expect cache hits on repeated agents:
      // Transitions with HOOK 2: REQUEST→router(M), router→plan(M), plan→architect(M),
      //   architect→plan(M), plan→pre_verify(HIT, plan cached from hop 2),
      //   pre_verify→code(M), code→post_verify(M), post_verify→code(HIT, code cached),
      //   code→post_verify(HIT, post_verify cached)
      expect(report.cacheHits).toBeGreaterThan(0);
      const hitRate = (report.cacheHits / (report.cacheHits + report.cacheMisses)) * 100;
      expect(hitRate).toBeGreaterThan(0);
    });
  });

  // ─── Flow D: LEVEL_3 Full ─────────────────────────────────────────

  describe('Flow D — LEVEL_3 Full', () => {
    it('should collect per-hop metrics for router → plan → architect → pre_verify → code → post_verify → COMMIT', () => {
      const flowGuard = new GuardService({ execution_id: 'bm-flow-d' });
      const report = runFlow(flowGuard, 'D — LEVEL_3 Full', [
        { from: 'REQUEST', to: 'router' },
        { from: 'router', to: 'plan', condition: 'LEVEL_3' },
        { from: 'plan', to: 'architect', condition: 'Architecture review needed' },
        { from: 'architect', to: 'pre_verify', condition: 'Architecture approved' },
        { from: 'pre_verify', to: 'code', condition: 'PASS' },
        { from: 'code', to: 'post_verify' },
        { from: 'post_verify', to: 'COMMIT', condition: 'PASS' },
      ]);

      const table = buildPerFlowTable(report);
      console.log(table);
      console.log('---');

      expect(report.hops.length).toBe(7);
      const nonCommitHops = report.hops.filter((h) => h.agent !== 'COMMIT');
      expect(nonCommitHops.length).toBe(6);

      for (const h of nonCommitHops) {
        if (h.agent !== 'router') {
          expect(h.routing_level).toBe('LEVEL_3');
        }
      }
      // All unique agents in this flow = 6 misses (router, plan, architect, pre_verify, code, post_verify)
      expect(report.cacheHits).toBe(0);
      expect(report.cacheMisses).toBe(6);
    });
  });

  // ─── Benchmark Summary Report ─────────────────────────────────────

  describe('benchmark summary report', () => {
    let flowA: FlowReport;
    let flowB: FlowReport;
    let flowC: FlowReport;
    let flowD: FlowReport;

    beforeAll(() => {
      // Run all 4 flows on fresh guards.
      // Each guard must be isolated: delete shared state file between instances
      // to prevent loadOrCreate from polluting one guard with another's state.
      function freshGuard(executionId: string): GuardService {
        try { fs.unlinkSync(GUARD_STATE_FILE); } catch { /* ignore */ }
        return new GuardService({ execution_id: executionId });
      }

      const gA = freshGuard('bm-sum-a');
      const gB = freshGuard('bm-sum-b');
      const gC = freshGuard('bm-sum-c');
      const gD = freshGuard('bm-sum-d');

      flowA = runFlow(gA, 'A — LEVEL_1', [
        { from: 'REQUEST', to: 'router' },
        { from: 'router', to: 'code', condition: 'LEVEL_1' },
        { from: 'code', to: 'post_verify' },
        { from: 'post_verify', to: 'COMMIT', condition: 'PASS' },
      ]);

      flowB = runFlow(gB, 'B — LEVEL_2', [
        { from: 'REQUEST', to: 'router' },
        { from: 'router', to: 'plan', condition: 'LEVEL_2' },
        { from: 'plan', to: 'pre_verify', condition: 'No architecture issues' },
        { from: 'pre_verify', to: 'code', condition: 'PASS' },
        { from: 'code', to: 'post_verify' },
        { from: 'post_verify', to: 'COMMIT', condition: 'PASS' },
      ]);

      flowC = runFlow(gC, 'C — LEVEL_3 Retry', [
        { from: 'REQUEST', to: 'router' },
        { from: 'router', to: 'plan', condition: 'LEVEL_3' },
        { from: 'plan', to: 'architect', condition: 'Architecture review needed' },
        { from: 'architect', to: 'plan', condition: 'Revision needed (max 1)' },
        { from: 'plan', to: 'pre_verify', condition: 'No architecture issues' },
        { from: 'pre_verify', to: 'code', condition: 'PASS' },
        { from: 'code', to: 'post_verify' },
        { from: 'post_verify', to: 'code', condition: 'FAIL (max 1 retry)' },
        { from: 'code', to: 'post_verify' },
        { from: 'post_verify', to: 'COMMIT', condition: 'PASS' },
      ]);

      flowD = runFlow(gD, 'D — LEVEL_3 Full', [
        { from: 'REQUEST', to: 'router' },
        { from: 'router', to: 'plan', condition: 'LEVEL_3' },
        { from: 'plan', to: 'architect', condition: 'Architecture review needed' },
        { from: 'architect', to: 'pre_verify', condition: 'Architecture approved' },
        { from: 'pre_verify', to: 'code', condition: 'PASS' },
        { from: 'code', to: 'post_verify' },
        { from: 'post_verify', to: 'COMMIT', condition: 'PASS' },
      ]);
    });

    it('should produce and log the full benchmark summary report', () => {
      const reports = [flowA, flowB, flowC, flowD];

      // Per-flow tables
      console.log('# Benchmark Results');
      console.log('');
      for (const r of reports) {
        console.log(buildPerFlowTable(r));
      }

      // Summary
      console.log(buildSummaryAcrossFlows(reports));
    });

    // ─── Validation Assertions ────────────────────────────────────

    it('should demonstrate L1 < L2 < L3 average context size', () => {
      // Collect non-COMMIT hops grouped by routing_level
      const levelGroups: Record<string, HopMetrics[]> = {};
      for (const flow of [flowA, flowB, flowC, flowD]) {
        for (const h of flow.hops) {
          if (h.agent === 'COMMIT') continue;
          const level = h.routing_level || 'none';
          if (!levelGroups[level]) levelGroups[level] = [];
          levelGroups[level].push(h);
        }
      }

      // Compute average total_chars per level (excluding COMMIT hops)
      function avgLevel(level: string): number {
        const hops = levelGroups[level];
        if (!hops || hops.length === 0) return 0;
        return hops.reduce((s, h) => s + h.total_chars, 0) / hops.length;
      }

      const avgL1 = avgLevel('LEVEL_1');
      const avgL2 = avgLevel('LEVEL_2');
      const avgL3 = avgLevel('LEVEL_3');

      console.log(`\nValidation: L1=${avgL1.toFixed(1)} < L2=${avgL2.toFixed(1)} < L3=${avgL3.toFixed(1)}`);

      expect(avgL1).toBeLessThan(avgL2);
      expect(avgL2).toBeLessThan(avgL3);
    });

    it('should demonstrate cache hit rate > 0% on retry flow (Flow C)', () => {
      const total = flowC.cacheHits + flowC.cacheMisses;
      const hitRate = total > 0 ? (flowC.cacheHits / total) * 100 : 0;
      console.log(`\nValidation: Flow C cache hit rate = ${hitRate.toFixed(1)}%`);
      expect(hitRate).toBeGreaterThan(0);
    });

    it('should demonstrate delta growth remains O(1) after hop 2', () => {
      // After hop 2, the number of NEW entries per hop should stabilize at O(1).
      // While the total formatted_chars grows because compressed_summary accumulates,
      // the count of new working memory entries per hop is bounded.
      for (const flow of [flowA, flowB, flowC, flowD]) {
        if (flow.deltas.length < 3) continue; // skip flows without enough deltas

        const afterHop2 = flow.deltas.slice(2); // deltas[0]=hop1, deltas[1]=hop2, rest after hop 2
        const maxNewAfter = Math.max(...afterHop2.map((d) => d.new_entries));
        const hop2New = flow.deltas[1]?.new_entries ?? 0;

        // New entries per hop should stabilize within a small bound after hop 2.
        // Each hop produces exactly 1 new entry (the departing agent's action).
        // With compressed summary + event diff, this may be 1-2 entries per hop.
        const bound = Math.max(hop2New * 2, 3);
        expect(maxNewAfter).toBeLessThanOrEqual(bound);

        console.log(
          `  ${flow.name}: hop2_new=${hop2New}, max_new_after_hop2=${maxNewAfter}, bound=${bound}`,
        );
      }
    });
  });
});
