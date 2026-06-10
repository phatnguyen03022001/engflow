/* @lifecycle ACTIVE — Cost projection writer (ADR-016) */

import * as fs from 'fs';
import * as path from 'path';
import { CostBreakdown } from '../types';

const COST_LOG_DIR = path.resolve(__dirname, '../../../.kilo/telemetry/cost');

export class CostLogWriter {
  private readonly dir: string;

  constructor(dir?: string) {
    this.dir = dir || COST_LOG_DIR;
    this.ensureDir();
  }

  /**
   * Append cost breakdowns as JSONL (one JSON object per line).
   * JSONL is append-friendly and supports streaming reads.
   */
  write(breakdowns: CostBreakdown[]): void {
    if (breakdowns.length === 0) return;

    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filePath = path.join(this.dir, `${date}.jsonl`);

    const lines = breakdowns.map(b => JSON.stringify(b)).join('\n') + '\n';
    fs.appendFileSync(filePath, lines, 'utf-8');
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }
}
