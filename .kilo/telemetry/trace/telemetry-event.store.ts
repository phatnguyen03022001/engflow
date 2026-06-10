/* @lifecycle ACTIVE — Immutable telemetry event store (ADR-016) */

import * as fs from 'fs';
import * as path from 'path';
import { TelemetryEvent } from '../types';

const TRACE_DIR = path.resolve(__dirname, '../../../.kilo/telemetry/traces');

export class TelemetryEventStore {
  private readonly dir: string;

  constructor(dir?: string) {
    this.dir = dir || TRACE_DIR;
    this.ensureDir();
  }

  /**
   * Append events to execution trace file.
   * File format: JSON array (immutable ledger).
   */
  append(executionId: string, events: TelemetryEvent[]): void {
    if (events.length === 0) return;

    const filePath = this.getFilePath(executionId);
    const existing = this.readFile(filePath);
    const merged = existing ? [...existing, ...events] : events;

    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  }

  /**
   * Load all events for an execution.
   * Returns empty array if no trace exists.
   */
  load(executionId: string): TelemetryEvent[] {
    const filePath = this.getFilePath(executionId);
    const existing = this.readFile(filePath);
    return existing || [];
  }

  /**
   * Check if trace exists for execution.
   */
  exists(executionId: string): boolean {
    return fs.existsSync(this.getFilePath(executionId));
  }

  private getFilePath(executionId: string): string {
    return path.join(this.dir, `${executionId}.json`);
  }

  private readFile(filePath: string): TelemetryEvent[] | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf-8').trim();
      if (!raw) return null;
      return JSON.parse(raw) as TelemetryEvent[];
    } catch {
      return null;
    }
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }
}
