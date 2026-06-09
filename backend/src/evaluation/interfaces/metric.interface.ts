// @lifecycle ACTIVE — Evaluation harness TypeScript interfaces and enums

export enum RouterRoute {
  LEVEL_1 = 'LEVEL_1',
  LEVEL_2 = 'LEVEL_2',
  LEVEL_3 = 'LEVEL_3',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum PreVerifyDecision {
  PASS = 'PASS',
  FLAG = 'FLAG',
  BLOCK = 'BLOCK',
}

export enum PostVerifyDecision {
  PASS = 'PASS',
  FLAG = 'FLAG',
  FAIL = 'FAIL',
  BLOCK = 'BLOCK',
}

export enum FinalOutcome {
  COMMITTED = 'COMMITTED',
  BLOCKED = 'BLOCKED',
  FAILED = 'FAILED',
  ABANDONED = 'ABANDONED',
}

export enum AgentPhaseType {
  ROUTER = 'ROUTER',
  PLAN = 'PLAN',
  ARCHITECT = 'ARCHITECT',
  PRE_VERIFY = 'PRE_VERIFY',
  CODE = 'CODE',
  POST_VERIFY = 'POST_VERIFY',
}

export enum AgentMetricType {
  ROUTER = 'ROUTER',
  PLANNER = 'PLANNER',
  CODE = 'CODE',
  DEBUG = 'DEBUG',
}

export enum MetricName {
  ACCURACY = 'ACCURACY',
  SUCCESS_RATE = 'SUCCESS_RATE',
  FIRST_ATTEMPT_RATE = 'FIRST_ATTEMPT_RATE',
  ESCALATION_RATE = 'ESCALATION_RATE',
  REVISION_RATE = 'REVISION_RATE',
}

export enum MetricWindow {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  ROLLING_7D = 'ROLLING_7D',
  ROLLING_30D = 'ROLLING_30D',
  ALL_TIME = 'ALL_TIME',
}

export interface MetricDimensionEntry {
  dimensionKey: string;
  dimensionValue: string;
  count: number;
  value: number;
}

export interface MetricSnapshot {
  agentType: string;
  metricName: string;
  metricValue: number;
  sampleSize: number;
  confidenceIntervalLow: number | null;
  confidenceIntervalHigh: number | null;
  window: string;
  computedAt: string;
  dimensions: MetricDimensionEntry[];
}

export interface ExecutionSummary {
  routerAccuracy: number | null;
  plannerAccuracy: number | null;
  plannerRevisionRate: number | null;
  codeFirstAttemptRate: number | null;
  codeOverallSuccess: number | null;
  debugSuccessRate: number | null;
  totalExecutions: number;
  computedAt: string;
}
