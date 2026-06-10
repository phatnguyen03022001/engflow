/* @lifecycle ACTIVE — Telemetry buffer configuration (ADR-016) */

import { TelemetryBufferConfig } from '../types';

export const DEFAULT_BUFFER_CONFIG: TelemetryBufferConfig = {
  maxEvents: 100,
  flushIntervalMs: 5000,
};