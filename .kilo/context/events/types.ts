/* @lifecycle ACTIVE — Stub types for Event pipeline (TASK-FIX-TS) */

/**
 * Result from the event compression pipeline.
 * Used by WorkingMemoryService.commitEvent() to record
 * compressed CI/CD pipeline results into working memory.
 */
export interface EventPipelineResult {
  events: unknown[];
  summary: string;
}
