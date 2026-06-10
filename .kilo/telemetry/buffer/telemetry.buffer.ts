/* @lifecycle ACTIVE — In-memory telemetry buffer with deduplication (ADR-016) */

import { TelemetryEvent, TelemetryBufferConfig } from '../types';
import { DEFAULT_BUFFER_CONFIG } from './buffer.model';

export class TelemetryBuffer {
  private readonly config: TelemetryBufferConfig;
  private events: TelemetryEvent[] = [];
  private readonly seenEventIds: Set<string> = new Set();

  constructor(config?: Partial<TelemetryBufferConfig>) {
    this.config = { ...DEFAULT_BUFFER_CONFIG, ...config };
  }

  append(event: TelemetryEvent): void {
    // Deduplication by eventId
    if (this.seenEventIds.has(event.eventId)) {
      return;
    }

    this.seenEventIds.add(event.eventId);
    this.events.push(event);
  }

  drain(): TelemetryEvent[] {
    const copy = [...this.events];
    this.events = [];
    this.seenEventIds.clear();
    return copy;
  }

  size(): number {
    return this.events.length;
  }

  shouldFlush(): boolean {
    return this.events.length >= this.config.maxEvents;
  }
}