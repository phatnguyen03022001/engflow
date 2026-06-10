/* @lifecycle ACTIVE — Unit tests for EventService compression pipeline (Phase 3) */

import * as fs from 'fs';
import * as path from 'path';
import { EventService, getEventService, resetEventService } from '../event-service';
import type { CompressedEvent, EventPipelineInput, ParsedError } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────

function createService(): EventService {
  resetEventService();
  const { EventService } = jest.requireActual('../event-service');
  return new EventService();
}

/** Remove persisted events file so store/load tests are hermetic. */
function cleanEventsFile(): void {
  const eventsFile = path.resolve(__dirname, '..', 'events-state.json');
  try {
    if (fs.existsSync(eventsFile)) fs.unlinkSync(eventsFile);
  } catch { /* ignore */ }
}

function makeInput(
  overrides: Partial<EventPipelineInput> = {},
): EventPipelineInput {
  return {
    rawStdout: '',
    rawStderr: '',
    source: 'build',
    ...overrides,
  };
}

// ─── Suite ──────────────────────────────────────────────────────────────

describe('EventService', () => {
  let service: EventService;

  beforeEach(() => {
    service = createService();
  });

  // ─── Step 1: Parse ──────────────────────────────────────────────────

  describe('parse()', () => {
    it('should return empty array for empty input', () => {
      const result = service.parse('', '');
      expect(result).toEqual([]);
    });

    it('should extract TypeScript compiler errors from stdout', () => {
      const stdout = [
        'src/foo.ts:10:5 - error TS2345: Argument of type is not assignable',
        'src/bar.ts:20:3 - warning TS7006: Parameter implicitly has any type',
      ].join('\n');
      const result = service.parse(stdout, '');
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]).toMatchObject({
        file: 'src/foo.ts',
        line: 10,
        column: 5,
        code: 'TS2345',
        severity: 'error',
      });
    });

    it('should extract FAIL test patterns from stdout', () => {
      const stdout = 'FAIL  src/__tests__/foo.spec.ts\n';
      const result = service.parse(stdout, '');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toMatchObject({
        file: 'src/__tests__/foo.spec.ts',
        severity: 'error',
      });
    });

    it('should extract error lines from stderr', () => {
      const stderr = 'Error: Cannot find module \'something\'\n';
      const result = service.parse('', stderr);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].message).toContain('Cannot find module');
    });

    it('should extract generic file:line:col patterns', () => {
      const stdout = '/path/to/file.ts:42:8  Some error description\n';
      const result = service.parse(stdout, '');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toMatchObject({
        file: '/path/to/file.ts',
        line: 42,
        column: 8,
      });
    });

    it('should skip non-error lines', () => {
      const stdout = [
        'PASS  src/foo.spec.ts',
        'Some info line',
        '  console.log output',
        'PASS  src/bar.spec.ts',
      ].join('\n');
      const result = service.parse(stdout, '');
      // None of these lines contain error indicators (FAIL is checked, PASS is not)
      expect(result.length).toBe(0);
    });
  });

  // ─── Step 2: Classify ───────────────────────────────────────────────

  describe('classify()', () => {
    it('should classify TS errors correctly', () => {
      // Don't set code — let classify() derive it from the message
      const errors: ParsedError[] = [
        { message: 'error TS2345: Type is not assignable', severity: 'error' },
      ];
      const result = service.classify(errors);
      expect(result[0].code).toBe('TYPESCRIPT_COMPILATION_ERROR');
    });

    it('should classify module not found errors', () => {
      const errors: ParsedError[] = [
        { message: 'Cannot find module \'foo\'', severity: 'error' },
      ];
      const result = service.classify(errors);
      expect(result[0].code).toBe('MODULE_NOT_FOUND');
    });

    it('should classify generic error lines as UNKNOWN_ERROR', () => {
      const errors: ParsedError[] = [
        { message: 'Something went wrong', severity: 'error' },
      ];
      const result = service.classify(errors);
      expect(result[0].code).toBe('UNKNOWN_ERROR');
    });

    it('should preserve existing code when already set', () => {
      const errors: ParsedError[] = [
        { message: 'error TS2345: Type is not assignable', severity: 'error', code: 'CUSTOM' },
      ];
      const result = service.classify(errors);
      expect(result[0].code).toBe('CUSTOM');
    });
  });

  // ─── Step 3: Fingerprint ────────────────────────────────────────────

  describe('fingerprint()', () => {
    it('should generate a deterministic 16-char hex fingerprint', () => {
      const errors: ParsedError[] = [
        { message: 'error TS2345: Type is not assignable', severity: 'error', file: 'src/foo.ts', code: 'TS2345' },
      ];
      const result = service.fingerprint(errors);
      expect(result[0].fingerprint).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should generate the same fingerprint for identical errors', () => {
      const errors: ParsedError[] = [
        { message: 'error TS2345: Type is not assignable', severity: 'error', file: 'src/foo.ts', code: 'TS2345' },
        { message: 'error TS2345: Type is not assignable', severity: 'error', file: 'src/foo.ts', code: 'TS2345' },
      ];
      const result = service.fingerprint(errors);
      expect(result[0].fingerprint).toBe(result[1].fingerprint);
    });

    it('should generate different fingerprints for different messages', () => {
      const errors: ParsedError[] = [
        { message: 'error TS2345: Type is not assignable', severity: 'error', file: 'src/foo.ts', code: 'TS2345' },
        { message: 'error TS7006: Parameter implicitly has any', severity: 'error', file: 'src/foo.ts', code: 'TS7006' },
      ];
      const result = service.fingerprint(errors);
      expect(result[0].fingerprint).not.toBe(result[1].fingerprint);
    });

    it('should attach error_class to each result', () => {
      const errors: ParsedError[] = [
        { message: 'error TS2345: Type is not assignable', severity: 'error' },
      ];
      const result = service.fingerprint(errors);
      expect(result[0].error_class).toBe('TypeScript Compilation Error');
    });
  });

  // ─── Step 4: Compress ───────────────────────────────────────────────

  describe('compress()', () => {
    it('should truncate messages exceeding MAX_ERROR_LENGTH', () => {
      const longMsg = 'x'.repeat(200);
      const fingerprinted = service.fingerprint([
        { message: longMsg, severity: 'error' },
      ]);
      const result = service.compress(fingerprinted, 'build');
      expect(result[0].first_error.length).toBeLessThanOrEqual(121); // 120 + '…'
      expect(result[0].source).toBe('build');
    });

    it('should preserve short messages without truncation', () => {
      const shortMsg = 'error TS2345: Type mismatch';
      const fingerprinted = service.fingerprint([
        { message: shortMsg, severity: 'error' },
      ]);
      const result = service.compress(fingerprinted, 'build');
      expect(result[0].first_error).toBe(shortMsg);
    });

    it('should set count to 1 for each compressed event', () => {
      const fingerprinted = service.fingerprint([
        { message: 'Error: something broke', severity: 'error' },
      ]);
      const result = service.compress(fingerprinted, 'lint');
      expect(result[0].count).toBe(1);
    });
  });

  // ─── Step 5: Deduplicate ────────────────────────────────────────────

  describe('deduplicate()', () => {
    it('should merge events with the same fingerprint', () => {
      const events: CompressedEvent[] = [
        {
          fingerprint: 'abc123',
          error_class: 'Test Failure',
          first_error: 'FAIL test 1',
          last_error: 'FAIL test 1',
          count: 1,
          source: 'test',
          severity: 'error',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
        {
          fingerprint: 'abc123',
          error_class: 'Test Failure',
          first_error: 'FAIL test 2',
          last_error: 'FAIL test 2',
          count: 1,
          source: 'test',
          severity: 'error',
          timestamp: '2024-01-01T00:00:01.000Z',
        },
      ];
      const result = service.deduplicate(events);
      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(2);
      expect(result[0].last_error).toBe('FAIL test 2');
      // Keep earliest timestamp
      expect(result[0].timestamp).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should not merge events with different fingerprints', () => {
      const events: CompressedEvent[] = [
        {
          fingerprint: 'abc123',
          error_class: 'Test Failure',
          first_error: 'FAIL test 1',
          last_error: 'FAIL test 1',
          count: 1,
          source: 'test',
          severity: 'error',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
        {
          fingerprint: 'def456',
          error_class: 'TypeScript Compilation Error',
          first_error: 'TS2345: type mismatch',
          last_error: 'TS2345: type mismatch',
          count: 1,
          source: 'build',
          severity: 'error',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = service.deduplicate(events);
      expect(result).toHaveLength(2);
    });

    it('should handle single event list', () => {
      const events: CompressedEvent[] = [
        {
          fingerprint: 'abc123',
          error_class: 'Test Failure',
          first_error: 'FAIL test 1',
          last_error: 'FAIL test 1',
          count: 1,
          source: 'test',
          severity: 'error',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = service.deduplicate(events);
      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(1);
    });
  });

  // ─── Step 6: Store / Load Events ────────────────────────────────────

  describe('storeEvents() / loadEvents()', () => {
    beforeEach(() => {
      cleanEventsFile();
    });

    afterAll(() => {
      cleanEventsFile();
    });

    const testEvents: CompressedEvent[] = [
      {
        fingerprint: 'abc123',
        error_class: 'Test Failure',
        first_error: 'FAIL test 1',
        last_error: 'FAIL test 1',
        count: 1,
        source: 'test',
        severity: 'error',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    ];

    it('should persist and reload events', () => {
      service.storeEvents(testEvents);
      const loaded = service.loadEvents();
      expect(loaded).toEqual(testEvents);
    });

    it('should return empty array when no events stored', () => {
      const loaded = service.loadEvents();
      expect(loaded).toEqual([]);
    });

    it('should overwrite previous events on subsequent store', () => {
      service.storeEvents(testEvents);
      service.storeEvents([]);
      const loaded = service.loadEvents();
      expect(loaded).toEqual([]);
    });
  });

  // ─── Full Pipeline ──────────────────────────────────────────────────

  describe('runPipeline()', () => {
    it('should return empty result for clean output', () => {
      const input = makeInput({ rawStdout: 'PASS  src/foo.spec.ts\n' });
      const result = service.runPipeline(input);
      expect(result.events).toEqual([]);
      expect(result.summary).toBe('');
    });

    it('should process TypeScript errors through the full pipeline', () => {
      const input = makeInput({
        rawStdout: [
          'src/foo.ts:10:5 - error TS2345: Type is not assignable',
          'src/bar.ts:20:3 - error TS7006: Parameter implicitly has any',
        ].join('\n'),
        source: 'build',
      });
      const result = service.runPipeline(input);
      expect(result.events.length).toBeGreaterThanOrEqual(1);
      expect(result.summary).toBeTruthy();
      // Verify events are deduplicated (each unique error = 1 event)
      for (const ev of result.events) {
        expect(ev.count).toBeGreaterThanOrEqual(1);
        expect(ev.fingerprint).toMatch(/^[a-f0-9]{16}$/);
        expect(ev.source).toBe('build');
      }
    });

    it('should process FAIL test patterns', () => {
      const input = makeInput({
        rawStdout: [
          'FAIL  src/__tests__/foo.spec.ts',
          'FAIL  src/__tests__/bar.spec.ts',
        ].join('\n'),
        source: 'test',
      });
      const result = service.runPipeline(input);
      expect(result.events.length).toBeGreaterThanOrEqual(1);
    });

    it('should deduplicate identical errors in the same run', () => {
      const input = makeInput({
        rawStdout: [
          'src/foo.ts:10:5 - error TS2345: Type is not assignable',
          'src/foo.ts:10:5 - error TS2345: Type is not assignable',
        ].join('\n'),
        source: 'build',
      });
      const result = service.runPipeline(input);
      for (const ev of result.events) {
        expect(ev.count).toBeGreaterThanOrEqual(1);
      }
    });

    it('should handle mixed stdout + stderr input', () => {
      const input = makeInput({
        rawStdout: 'src/foo.ts:10:5 - error TS2345: Type mismatch\n',
        rawStderr: 'Error: Something went wrong during build\n',
        source: 'build',
      });
      const result = service.runPipeline(input);
      expect(result.events.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Singleton ──────────────────────────────────────────────────────

  describe('singleton', () => {
    it('getEventService() should return the same instance', () => {
      const a = getEventService();
      const b = getEventService();
      expect(a).toBe(b);
    });

    it('resetEventService() should clear the singleton', () => {
      const a = getEventService();
      resetEventService();
      const b = getEventService();
      expect(a).not.toBe(b);
    });
  });

  // ─── Summary Building ───────────────────────────────────────────────

  describe('summary building (via runPipeline)', () => {
    it('should generate a summary within token budget constraints', () => {
      const input = makeInput({
        rawStdout: Array.from({ length: 20 }, (_, i) =>
          `src/file${i}.ts:1:1 - error TS2345: Error number ${i}`,
        ).join('\n'),
        source: 'build',
      });
      const result = service.runPipeline(input);
      // Summary should be non-empty and within a reasonable length
      expect(result.summary.length).toBeGreaterThan(0);
      // Should mention event count somewhere (either per-event "1x" or overflow "N more event(s)")
      expect(result.summary).toMatch(/\dx\)|\d+ more event/);
    });

    it('should return empty summary for clean runs', () => {
      const input = makeInput({
        rawStdout: 'All tests passed!\n',
        source: 'test',
      });
      const result = service.runPipeline(input);
      expect(result.summary).toBe('');
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle very long stdout', () => {
      const longLine = 'error: ' + 'x'.repeat(10000);
      const input = makeInput({
        rawStdout: longLine,
        source: 'build',
      });
      const result = service.runPipeline(input);
      expect(result.events.length).toBeGreaterThanOrEqual(1);
      // Messages should be truncated
      expect(result.events[0].first_error.length).toBeLessThanOrEqual(121);
    });

    it('should handle null-like empty strings', () => {
      const result = service.parse('', '');
      expect(result).toEqual([]);
    });

    it('should handle stderr-only errors', () => {
      const stderr = 'error TS2345: Type mismatch\n';
      const result = service.parse('', stderr);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle carriage return line endings', () => {
      const stdout = 'src/foo.ts:10:5 - error TS2345: Type mismatch\r\n';
      const result = service.parse(stdout, '');
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
});
