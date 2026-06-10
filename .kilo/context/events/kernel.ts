/* @lifecycle ACTIVE — Event compression kernel: commitEvent() entry point (Phase 3) */

import { getEventService } from './event-service';
import { getWorkingMemory } from '../index';
import type { EventPipelineInput, EventPipelineResult } from './types';

/**
 * Commit a raw command output as compressed events into working memory.
 *
 * This is the top-level entry point for the event compression system.
 * It runs the full 6-step pipeline and records the resulting summary
 * into working memory via commitEvent().
 *
 * @param params.rawStdout   Full raw stdout from the command.
 * @param params.rawStderr   Full raw stderr from the command.
 * @param params.source      Source identifier ("build", "lint", "test").
 * @param params.executionId The active execution ID for working memory.
 */
export function commitCommandOutput(params: {
  rawStdout: string;
  rawStderr: string;
  source: string;
  executionId: string;
}): EventPipelineResult {
  const { rawStdout, rawStderr, source, executionId } = params;

  // Run the pipeline
  const eventService = getEventService();
  const input: EventPipelineInput = { rawStdout, rawStderr, source };
  const result = eventService.runPipeline(input);

  // Record to working memory
  const wm = getWorkingMemory();
  wm.commitEvent(executionId, source, result);

  return result;
}
