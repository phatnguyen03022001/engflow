/* @lifecycle ACTIVE — Flush scheduler with count/time/COMMIT triggers (ADR-016) */

import { TelemetryEvent, TelemetryBufferConfig } from '../types';
import { DEFAULT_BUFFER_CONFIG } from '../buffer/buffer.model';
import { TelemetryBuffer } from '../buffer/telemetry.buffer';
import { TelemetryPipeline, PipelineResult } from './telemetry.pipeline';

export type FlushTrigger = 'COUNT' | 'TIME' | 'COMMIT' | 'MANUAL';

export interface FlushResult {
  trigger: FlushTrigger;
  result: PipelineResult;
}

export class FlushScheduler {
  private lastFlushTime: number = Date.now();
  private flushCount: number = 0;

  constructor(
    private readonly buffer: TelemetryBuffer,
    private readonly pipeline: TelemetryPipeline,
    private readonly config: TelemetryBufferConfig = DEFAULT_BUFFER_CONFIG
  ) {}

  /**
   * Check if flush is needed and execute if so.
   * Returns null if no flush occurred.
   */
  maybeFlush(trigger: FlushTrigger = 'MANUAL'): FlushResult | null {
    const shouldFlush =
      trigger === 'COMMIT' ||
      trigger === 'MANUAL' ||
      this.buffer.shouldFlush() ||
      this.elapsedSinceLastFlush() >= this.config.flushIntervalMs;

    if (!shouldFlush) {
      return null;
    }

    return this.executeFlush(trigger);
  }

  /**
   * Force flush regardless of thresholds.
   */
  forceFlush(trigger: FlushTrigger = 'MANUAL'): FlushResult {
    return this.executeFlush(trigger);
  }

  getFlushCount(): number {
    return this.flushCount;
  }

  getLastFlushTime(): number {
    return this.lastFlushTime;
  }

  private executeFlush(trigger: FlushTrigger): FlushResult {
    const events = this.buffer.drain();
    try {
      const result = this.pipeline.flush(events);

      this.lastFlushTime = Date.now();
      this.flushCount += 1;

      return { trigger, result };
    } catch (error) {
      // Re-add events on failure so they're not lost
      events.forEach(e => this.buffer.append(e));
      throw error;
    }
  }

  private elapsedSinceLastFlush(): number {
    return Date.now() - this.lastFlushTime;
  }
}
