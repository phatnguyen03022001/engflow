/* @lifecycle ACTIVE — Cost report TypeScript interfaces (ADR-010) */

export interface CostSummary {
  totalCostUsd: number;
  totalRequests: number;
  avgCostPerRequest: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  window: string;
  computedAt: string;
}

export interface CostByModel {
  modelId: string;
  displayName: string;
  costUsd: number;
  requests: number;
  avgLatencyMs: number;
  percentageOfTotal: number;
}

export interface CostByDay {
  date: string;
  costUsd: number;
  requests: number;
}

export interface CostReport {
  summary: CostSummary;
  byModel: CostByModel[];
  byDay: CostByDay[];
  projection: {
    projectedMonthlyUsd: number;
    budgetUsd: number;
    withinBudget: boolean;
    daysInWindow: number;
  };
}

export interface CostLogEntry {
  id: string;
  modelId: string;
  executionId: string;
  phaseId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  wasFallback: boolean;
  fallbackFrom: string | null;
  recordedAt: Date;
}
