/* @lifecycle ACTIVE — Event compression types: CompressedEvent, pipeline I/O, error classification (Phase 3) */

/**
 * Severity level for a parsed or compressed event.
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * A single error line parsed from raw stdout/stderr.
 */
export interface ParsedError {
  /** The full error message text. */
  message: string;
  /** Source file path, if identifiable from the output. */
  file?: string;
  /** Line number, if present. */
  line?: number;
  /** Column number, if present. */
  column?: number;
  /** Error severity. */
  severity: ErrorSeverity;
  /** Error/diagnostic code, e.g. "TS2345", "2322". */
  code?: string;
}

/**
 * A compressed, deduplicated event produced by the pipeline.
 * Token budget: the combined first_error + last_error should fit ~30-60 tokens.
 */
export interface CompressedEvent {
  /** Deterministic hash fingerprint for deduplication. */
  fingerprint: string;
  /** Classified error class, e.g. "TypeScript Compilation Error". */
  error_class: string;
  /** First occurrence of this error (truncated to fit token budget). */
  first_error: string;
  /** Last occurrence of this error (truncated to fit token budget). */
  last_error: string;
  /** How many raw lines matched this fingerprint. */
  count: number;
  /** Source stage: "build", "lint", "test". */
  source: string;
  /** Error severity. */
  severity: ErrorSeverity;
  /** ISO-8601 timestamp of first occurrence. */
  timestamp: string;
}

/**
 * Raw input fed into the event compression pipeline.
 */
export interface EventPipelineInput {
  /** Full raw stdout content from a command execution. */
  rawStdout: string;
  /** Full raw stderr content from a command execution. */
  rawStderr: string;
  /** Source identifier: "build", "lint", "test". */
  source: string;
}

/**
 * Result produced by the event compression pipeline.
 */
export interface EventPipelineResult {
  /** Deduplicated, compressed events. */
  events: CompressedEvent[];
  /** Human-readable compressed summary (~30-60 tokens / ~120-240 chars). */
  summary: string;
}

/**
 * Classification rule: a regex pattern + label mapping.
 */
export interface ClassificationRule {
  /** Regex to match against an error message. */
  pattern: RegExp;
  /** Human-readable error class label if pattern matches. */
  label: string;
}
