// @lifecycle ACTIVE — Trust score TypeScript types

/**
 * Map a trust score to a human-readable label.
 *
 * SYNC NOTE: this logic is duplicated in kilo.jsonc Ask prompt.
 * If you change these thresholds, update the Ask prompt text accordingly.
 */
export function getTrustLabel(score: number): string {
  if (score >= 90) return 'VERY HIGH';
  if (score >= 75) return 'HIGH';
  if (score >= 60) return 'MODERATE';
  if (score >= 40) return 'LOW';
  return 'UNTRUSTED';
}

export interface TrustScoreResult {
  level: string;
  domain: string | null;
  decisionType: string | null;
  score: number;
  sampleSize: number;
  displayScore: number;
  displayLabel: string;
  confidenceInterval: string;
}

export interface AccuracyMetrics {
  overallAccuracy: number | null;
  weightedAccuracy: number | null;
  brierScore: number | null;
  confidenceInterval: number | null;
  sampleSize: number;
  totalRecommendations: number;
  totalAssessed: number;
  falsePositiveRate: number | null;
  falseNegativeRate: number | null;
  regretRate: number | null;
  reversalRate: number | null;
  implementationRate: number | null;
  status: string;
  trend: string;
  trendValue: number;
  byConfidenceLevel: Record<string, { accuracy: number; count: number }>;
  byDecisionType: Record<string, { accuracy: number; count: number }>;
  warnings: Array<{ severity: string; message: string }>;
}

export type PriorConfig = {
  alpha: number;
  beta: number;
  priorTrust: number;
};

export const PRIOR_CONFIGS: Record<string, PriorConfig> = {
  TC: { alpha: 8, beta: 2, priorTrust: 0.8 },
  TS: { alpha: 8, beta: 2, priorTrust: 0.8 },
  IA: { alpha: 7, beta: 3, priorTrust: 0.7 },
  BB: { alpha: 6, beta: 4, priorTrust: 0.6 },
  PC: { alpha: 5, beta: 5, priorTrust: 0.5 },
  AP: { alpha: 5, beta: 5, priorTrust: 0.5 },
  GLOBAL: { alpha: 6, beta: 4, priorTrust: 0.6 },
};
