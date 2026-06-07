// @lifecycle ACTIVE — Recommendation registry TypeScript interfaces

export enum RecommendationMode {
  ADVISOR = 'ADVISOR',
  STRATEGY = 'STRATEGY',
  LEADERSHIP = 'LEADERSHIP',
}

export enum DecisionType {
  TC = 'TC', // TECHNOLOGY_CHOICE
  AP = 'AP', // ARCHITECTURE_PATTERN
  IA = 'IA', // IMPLEMENTATION_APPROACH
  TS = 'TS', // TOOL_SELECTION
  PC = 'PC', // PROCESS_CHANGE
  BB = 'BB', // BUILD_VS_BUY
}

export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  REJECT = 'REJECT',
}

export enum TrackingStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  ASSESSED = 'ASSESSED',
}

export enum FinalOutcome {
  SUCCESS = 'SUCCESS',
  MIXED = 'MIXED',
  FAILURE = 'FAILURE',
  ABANDONED = 'ABANDONED',
}

export enum CheckpointPeriod {
  _30D = '30D',
  _90D = '90D',
  _180D = '180D',
}

export enum CheckpointVerdict {
  ON_TRACK = 'ON_TRACK',
  CONCERN = 'CONCERN',
  PROBLEM = 'PROBLEM',
  FAILED = 'FAILED',
}

export enum ImplementationFaith {
  EXACT = 'EXACT',
  ADAPTED = 'ADAPTED',
  DIVERGED = 'DIVERGED',
  IGNORED = 'IGNORED',
}

export enum DebtLevel {
  NONE = 'NONE',
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  MAJOR = 'MAJOR',
}

export enum PerformanceImpact {
  IMPROVED = 'IMPROVED',
  NEUTRAL = 'NEUTRAL',
  DEGRADED = 'DEGRADED',
  UNKNOWN = 'UNKNOWN',
}

export enum TeamSatisfaction {
  SATISFIED = 'SATISFIED',
  NEUTRAL = 'NEUTRAL',
  DISSATISFIED = 'DISSATISFIED',
  UNKNOWN = 'UNKNOWN',
}

export enum VerdictConfidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum MemoryOutcome {
  SUCCESS = 'SUCCESS',
  MIXED = 'MIXED',
  FAILURE = 'FAILURE',
}

export enum TrustLevel {
  GLOBAL = 'GLOBAL',
  DECISION_TYPE = 'DECISION_TYPE',
  DOMAIN = 'DOMAIN',
  DOMAIN_TYPE = 'DOMAIN_TYPE',
}

export interface OptionEntry {
  label: string;
  description: string;
  score: number;
}

export interface RiskEntry {
  description: string;
  severity: string;
  materialized?: boolean;
}

export interface ContextFactor {
  techStack?: string;
  scale?: string;
  teamSize?: string;
  timeline?: string;
}

export interface ConfidenceCalibration {
  HIGH?: number;
  MEDIUM?: number;
  LOW?: number;
}
