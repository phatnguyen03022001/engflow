/* @lifecycle ACTIVE — Event compression pipeline: 6-step (parse, classify, fingerprint, compress, deduplicate, store) (Phase 3) */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  ParsedError,
  CompressedEvent,
  EventPipelineInput,
  EventPipelineResult,
  ClassificationRule,
  ErrorSeverity,
} from './types';

// ─── Constants ──────────────────────────────────────────────────────────

/**
 * Token budget for the compressed summary: ~30-60 tokens.
 * Using ~4 chars per token for English text, target ~120-240 chars.
 */
const SUMMARY_MIN_CHARS = 120;
const SUMMARY_MAX_CHARS = 240;

/**
 * Maximum length for a single error message in a compressed event.
 */
const MAX_ERROR_LENGTH = 120;

/**
 * Events persistence file path.
 */
const EVENTS_FILE = path.resolve(__dirname, '..', 'events', 'events-state.json');

// ─── Classification Rules ───────────────────────────────────────────────

/**
 * Built-in classification rules matched against error messages.
 * Ordered: more specific patterns first, general fallbacks last.
 */
const CLASSIFICATION_RULES: ClassificationRule[] = [
  // TypeScript compiler errors
  { pattern: /TS\d+:/, label: 'TypeScript Compilation Error' },
  // Prisma errors
  { pattern: /PrismaClient(Initialization|KnownRequest|Unknown)Error/, label: 'Prisma Client Error' },
  { pattern: /prisma:/i, label: 'Prisma Error' },
  // NestJS errors
  { pattern: /Nest\s+(can\'t|cannot|could not)/i, label: 'NestJS Boot Error' },
  // Jest test failures
  { pattern: /FAIL\s+/, label: 'Test Failure' },
  { pattern: /expect\(/, label: 'Assertion Failure' },
  // Module resolution
  { pattern: /Cannot find module/, label: 'Module Not Found' },
  { pattern: /Module not found/, label: 'Module Not Found' },
  // Syntax/parse errors
  { pattern: /SyntaxError/, label: 'Syntax Error' },
  { pattern: /Unexpected token/, label: 'Syntax Error' },
  // Generic type errors
  { pattern: /TypeError/, label: 'Type Error' },
  { pattern: /ReferenceError/, label: 'Reference Error' },
  // Lint errors
  { pattern: /warning\s+.*@typescript-eslint/i, label: 'Lint Warning' },
  { pattern: /error\s+.*@typescript-eslint/i, label: 'Lint Error' },
  // Generic error lines
  { pattern: /^Error:/, label: 'Runtime Error' },
  { pattern: /^ERROR:/, label: 'Runtime Error' },
  { pattern: /error/i, label: 'Unclassified Error' },
];

// ─── EventService ───────────────────────────────────────────────────────

export class EventService {
  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Run the full 6-step pipeline: parse → classify → fingerprint →
   * compress → deduplicate → store.
   */
  runPipeline(input: EventPipelineInput): EventPipelineResult {
    // Step 1: Parse raw output into structured error lines
    const parsed = this.parse(input.rawStdout, input.rawStderr);

    if (parsed.length === 0) {
      const result: EventPipelineResult = { events: [], summary: '' };
      this.storeEvents(result.events);
      return result;
    }

    // Step 2: Classify each parsed error
    const classified = this.classify(parsed);

    // Step 3: Generate deterministic fingerprints
    const fingerprinted = this.fingerprint(classified);

    // Step 4: Compress error messages to fit token budget
    const compressed = this.compress(fingerprinted, input.source);

    // Step 5: Deduplicate by fingerprint
    const deduped = this.deduplicate(compressed);

    // Build compressed summary
    const summary = this.buildSummary(deduped);

    // Step 6: Store to disk
    this.storeEvents(deduped);

    return { events: deduped, summary };
  }

  /**
   * Load persisted events from disk.
   */
  loadEvents(): CompressedEvent[] {
    try {
      if (!fs.existsSync(EVENTS_FILE)) return [];
      const raw = fs.readFileSync(EVENTS_FILE, 'utf-8').trim();
      if (!raw) return [];
      return JSON.parse(raw) as CompressedEvent[];
    } catch {
      return [];
    }
  }

  // ─── Step 1: Parse ──────────────────────────────────────────────

  /**
   * Extract structured error lines from raw stdout and stderr.
   */
  parse(rawStdout: string, rawStderr: string): ParsedError[] {
    const results: ParsedError[] = [];

    // Process both stdout and stderr
    const allLines = [
      ...this.splitLines(rawStdout).map((l) => ({ line: l, source: 'stdout' as const })),
      ...this.splitLines(rawStderr).map((l) => ({ line: l, source: 'stderr' as const })),
    ];

    for (const { line: rawLine } of allLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      // Only consider lines that look like errors (contain error indicators)
      if (!this.isErrorLine(trimmed)) continue;

      const parsed = this.parseErrorLine(trimmed);
      if (parsed) {
        results.push(parsed);
      }
    }

    return results;
  }

  // ─── Step 2: Classify ───────────────────────────────────────────

  /**
   * Assign error_class to each parsed error by matching against classification rules.
   */
  classify(errors: ParsedError[]): ParsedError[] {
    return errors.map((err) => {
      // Classification happens in the fingerprint step via error_class;
      // we attach a code-derived class here if not already present
      const classification = this.classifyMessage(err.message);
      return {
        ...err,
        code: err.code ?? classification.classCode,
      };
    });
  }

  // ─── Step 3: Fingerprint ────────────────────────────────────────

  /**
   * Generate a deterministic SHA-256 fingerprint (first 16 chars hex) for each error.
   */
  fingerprint(errors: ParsedError[]): (ParsedError & { fingerprint: string; error_class: string })[] {
    return errors.map((err) => {
      const classification = this.classifyMessage(err.message);
      // Normalize the message for fingerprinting: lowercase, collapse whitespace
      const normalized = `${err.file ?? ''}|${err.code ?? ''}|${classification.label}|${err.message.toLowerCase().replace(/\s+/g, ' ').trim()}`;
      const hash = crypto.createHash('sha256').update(normalized).digest('hex');
      const fingerprint = hash.substring(0, 16);

      return {
        ...err,
        fingerprint,
        error_class: classification.label,
      };
    });
  }

  // ─── Step 4: Compress ───────────────────────────────────────────

  /**
   * Truncate error messages to fit within the token budget.
   */
  compress(
    errors: (ParsedError & { fingerprint: string; error_class: string })[],
    source: string,
  ): CompressedEvent[] {
    return errors.map((err) => {
      const truncated = this.truncateMessage(err.message, MAX_ERROR_LENGTH);
      return {
        fingerprint: err.fingerprint,
        error_class: err.error_class,
        first_error: truncated,
        last_error: truncated,
        count: 1,
        source,
        severity: err.severity,
        timestamp: new Date().toISOString(),
      };
    });
  }

  // ─── Step 5: Deduplicate ────────────────────────────────────────

  /**
   * Merge events with the same fingerprint, updating count and last_error.
   */
  deduplicate(events: CompressedEvent[]): CompressedEvent[] {
    const map = new Map<string, CompressedEvent>();

    for (const event of events) {
      const existing = map.get(event.fingerprint);
      if (existing) {
        existing.count += 1;
        existing.last_error = event.first_error;
        // Keep earliest timestamp
        if (event.timestamp < existing.timestamp) {
          existing.timestamp = event.timestamp;
        }
      } else {
        map.set(event.fingerprint, { ...event });
      }
    }

    return Array.from(map.values());
  }

  // ─── Step 6: Store ──────────────────────────────────────────────

  /**
   * Persist deduplicated events to disk as JSON array.
   */
  storeEvents(events: CompressedEvent[]): void {
    const dir = path.dirname(EVENTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2) + '\n', 'utf-8');
  }

  // ─── Private Helpers ────────────────────────────────────────────

  /**
   * Build a compressed human-readable summary within the 30-60 token budget.
   */
  private buildSummary(events: CompressedEvent[]): string {
    if (events.length === 0) return '';

    const parts: string[] = [];
    let totalChars = 0;

    for (const ev of events) {
      const line = `[${ev.severity}] ${ev.error_class}: ${ev.first_error} (${ev.count}x)`;
      const lineLen = line.length;

      if (totalChars + lineLen > SUMMARY_MAX_CHARS && parts.length > 0) {
        // Budget exhausted — append overflow note and stop
        const remaining = events.length - parts.length;
        if (remaining > 0) {
          parts.push(`… and ${remaining} more event(s)`);
        }
        break;
      }

      parts.push(line);
      totalChars += lineLen;
    }

    // Pad if under minimum budget with filler note
    const summary = parts.join('\n');
    if (summary.length < SUMMARY_MIN_CHARS && events.length > 0) {
      return `${summary}\nTotal: ${events.length} event(s) across ${new Set(events.map((e) => e.error_class)).size} class(es).`;
    }

    return summary;
  }

  /**
   * Check if a line looks like it contains error information.
   */
  private isErrorLine(line: string): boolean {
    const errorIndicators = [
      /^Error:/i,
      /^ERROR:/,
      /^FAIL/i,
      /error/i,
      /warning/i,
      /TS\d+:/,
      /Cannot find/i,
      /Module not found/i,
      /SyntaxError/i,
      /TypeError/i,
      /ReferenceError/i,
      /expect\(/,
      /prisma:/i,
      /Unexpected/i,
    ];
    return errorIndicators.some((pattern) => pattern.test(line));
  }

  /**
   * Parse a single line to extract file, line, column, code, severity, and message.
   */
  private parseErrorLine(line: string): ParsedError | null {
    // Try TypeScript-style: src/file.ts:line:col - error TS2345: message
    const tsMatch = line.match(
      /^([^:]+\.(?:ts|tsx|js|jsx)):(\d+):(\d+)\s*-\s*(error|warning)\s+(TS\d+):\s*(.+)$/i,
    );
    if (tsMatch) {
      return {
        message: tsMatch[6].trim(),
        file: tsMatch[1],
        line: parseInt(tsMatch[2], 10),
        column: parseInt(tsMatch[3], 10),
        severity: tsMatch[4].toLowerCase() === 'error' ? 'error' : 'warning',
        code: tsMatch[5],
      };
    }

    // Try generic file:line:col pattern
    const genericMatch = line.match(
      /^([^:]+\.\w+):(\d+):(\d+)\s+(.+)$/,
    );
    if (genericMatch) {
      return {
        message: genericMatch[4].trim(),
        file: genericMatch[1],
        line: parseInt(genericMatch[2], 10),
        column: parseInt(genericMatch[3], 10),
        severity: this.detectSeverity(genericMatch[4]),
      };
    }

    // Try FAIL test pattern: FAIL  path/to/test.spec.ts
    const failMatch = line.match(/^FAIL\s+(.+\.spec\.ts)/);
    if (failMatch) {
      return {
        message: line.trim(),
        file: failMatch[1],
        severity: 'error',
      };
    }

    // Fallback: treat as generic error line
    return {
      message: line.trim(),
      severity: this.detectSeverity(line),
    };
  }

  /**
   * Detect severity from a line of text.
   */
  private detectSeverity(text: string): ErrorSeverity {
    const lower = text.toLowerCase();
    if (lower.startsWith('error') || lower.includes('error:')) return 'error';
    if (lower.startsWith('warning') || lower.includes('warning:')) return 'warning';
    if (/^FAIL/i.test(text)) return 'error';
    return 'info';
  }

  /**
   * Classify an error message against the rules list and return label + class code.
   */
  private classifyMessage(message: string): { label: string; classCode: string } {
    for (const rule of CLASSIFICATION_RULES) {
      if (rule.pattern.test(message)) {
        return { label: rule.label, classCode: rule.label.replace(/\s+/g, '_').toUpperCase() };
      }
    }
    return { label: 'Unknown Error', classCode: 'UNKNOWN_ERROR' };
  }

  /**
   * Truncate a message to fit within maxChars, preserving word boundaries.
   */
  private truncateMessage(message: string, maxChars: number): string {
    if (message.length <= maxChars) return message;
    const truncated = message.substring(0, maxChars);
    // Try to break at a word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxChars * 0.8) {
      return truncated.substring(0, lastSpace) + '…';
    }
    return truncated + '…';
  }

  /**
   * Split text into lines, handling various line endings.
   */
  private splitLines(text: string): string[] {
    if (!text) return [];
    return text.split(/\r?\n/);
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────

let eventServiceInstance: EventService | null = null;

/**
 * Get or create the singleton EventService instance.
 */
export function getEventService(): EventService {
  if (!eventServiceInstance) {
    eventServiceInstance = new EventService();
  }
  return eventServiceInstance;
}

/**
 * Reset the EventService singleton (for testing).
 */
export function resetEventService(): void {
  eventServiceInstance = null;
}
