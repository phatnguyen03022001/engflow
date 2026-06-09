/* @lifecycle ACTIVE — Internal interface for analytics/scoring fields */
/* @tags backend, recommendation */

/**
 * Analytics and scoring fields that are server-controlled only.
 *
 * These values are NEVER accepted from user/external input.
 * Trusted internal callers (e.g., Ask-ingest pipeline) can provide them
 * via the RecommendationService.create() analytics parameter.
 * When not provided, safe defaults are used.
 */
export interface RecommendationAnalytics {
  confidenceScore: number;
  weightedScore: number;
  scoreMargin: number;
  ecs?: number;
  sqs?: number;
  cs?: number;
}
