/* @lifecycle ACTIVE — Telemetry types for Event-to-Cost Pipeline (ADR-016) */

export interface TokenUsage {
  input: number;
  output: number;
  reasoning?: number;
  cache?: { read: number; write: number };
}

export interface TelemetryEvent {
  eventId: string;           // UUID v7 — idempotency key
  executionId: string;       // UUID v7 — correlates to ExecutionLock
  phaseId: string;           // UUID v7 — correlates to ExecutionPhase
  agentType: string;         // 'router' | 'plan' | 'architect' | 'code' | 'pre_verify' | 'post_verify'
  modelUsed: string;         // e.g. 'deepseek/deepseek-v4-flash'
  tokens: TokenUsage;
  timestamp: number;         // Unix epoch ms
}

export interface CostBreakdown {
  eventId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

export interface ModelPricing {
  model: string;
  inputPer1k: number;
  outputPer1k: number;
  reasoningPer1k?: number;
  cacheReadPer1k?: number;
  cacheWritePer1k?: number;
}

export class PricingNotFoundError extends Error {
  constructor(model: string) {
    super(`Pricing not found for model: ${model}`);
    this.name = 'PricingNotFoundError';
  }
}

export interface TelemetryBufferConfig {
  maxEvents: number;         // Default: 100
  flushIntervalMs: number;   // Default: 5000
}