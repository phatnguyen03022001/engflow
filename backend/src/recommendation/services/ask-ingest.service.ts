// @lifecycle ACTIVE — Ask agent output ingestion service

import { Injectable, Logger } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { CreateRecommendationDto } from '../dto/create-recommendation.dto';
import { RecommendationAnalytics } from '../interfaces/recommendation-analytics.interface';

/**
 * Patterns for parsing Ask agent's structured recommendation records.
 *
 * Expected format in Ask's output:
 *   ---RECOMMENDATION-RECORD---
 *   rec_id: REC-20260607-a1b2c3d4
 *   mode: ADVISOR
 *   decision_type: TC
 *   decision_domain: queue-system
 *   query_summary: "Should we use BullMQ?"
 *   project_id: floweng
 *   recommended_option: BullMQ
 *   confidence_level: HIGH
 *   confidence_score: 82
 *   ---END-RECORD---
 */
@Injectable()
export class AskIngestService {
  private readonly logger = new Logger(AskIngestService.name);

  constructor(
    private readonly recommendationService: RecommendationService,
  ) {}

  /**
   * Parse a structured record from Ask's output text.
   * Returns extracted fields or null if no valid record found.
   */
  parseStructuredRecord(text: string): Record<string, string> | null {
    const recordMatch = text.match(
      /---RECOMMENDATION-RECORD---\n([\s\S]*?)---END-RECORD---/,
    );
    if (!recordMatch) return null;

    const body = recordMatch[1];
    const fields: Record<string, string> = {};

    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;

      const key = trimmed.slice(0, colonIdx).trim();
      let value = trimmed.slice(colonIdx + 1).trim();

      // Remove surrounding quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      fields[key] = value;
    }

    return Object.keys(fields).length > 0 ? fields : null;
  }

  /**
   * Convert parsed fields to a CreateRecommendationDto.
   * This is a simplified conversion — full parsing requires the
   * complete Advisory Report output.
   *
   * Analytics/scoring fields (confidenceScore, weightedScore, scoreMargin,
   * ecs, sqs, cs) are handled separately via buildAnalytics() and are NOT
   * included in the DTO.
   */
  fieldsToDto(fields: Record<string, string>): CreateRecommendationDto | null {
    // Minimum required fields (analytics/scoring fields excluded — handled separately)
    const required = [
      'rec_id',
      'mode',
      'decision_type',
      'decision_domain',
      'query_summary',
      'recommended_option',
      'confidence_level',
    ];

    for (const field of required) {
      if (!fields[field]) {
        this.logger.warn(`Missing required field: ${field}`);
        return null;
      }
    }

    return {
      recId: fields['rec_id'],
      mode: fields['mode'],
      decisionType: fields['decision_type'],
      decisionDomain: fields['decision_domain'],
      querySummary: fields['query_summary'],
      projectId: fields['project_id'] ?? undefined,
      constraints: fields['constraints']?.split(',').map((s) => s.trim()) ?? [],
      sourcesConsulted: [],
      recommendedOption: fields['recommended_option'],
      justification: fields['justification'] ?? '',
      confidenceLevel: fields['confidence_level'],
      unknownsCount: fields['unknowns_count']
        ? parseInt(fields['unknowns_count'], 10)
        : undefined,
      unknownsCritical: fields['unknowns_critical']
        ? parseInt(fields['unknowns_critical'], 10)
        : undefined,
      expectedOutcome: fields['expected_outcome'],
      debtForecast: fields['debt_forecast'],
      timelineToValue: fields['timeline_to_value'],
      whenToRevisit: fields['when_to_revisit'],
      reasoningTrace: fields['reasoning_trace'],
      advisoryReportRef: fields['advisory_report_ref'],
      modelVersion: fields['model_version'],
    };
  }

  /**
   * Build analytics/scoring fields from parsed fields.
   * These values are server-controlled and passed separately to the
   * RecommendationService to prevent injection from untrusted input.
   */
  buildAnalytics(fields: Record<string, string>): RecommendationAnalytics {
    const confidenceScore = parseInt(fields['confidence_score'], 10);

    return {
      confidenceScore: isNaN(confidenceScore) ? 0 : confidenceScore,
      weightedScore: parseFloat(fields['weighted_score'] ?? '0') || 3.0,
      scoreMargin: parseFloat(fields['score_margin'] ?? '0') || 0,
      ecs: fields['ecs'] ? parseFloat(fields['ecs']) : undefined,
      sqs: fields['sqs'] ? parseFloat(fields['sqs']) : undefined,
      cs: fields['cs'] ? parseFloat(fields['cs']) : undefined,
    };
  }

  /**
   * Ingest a structured record from Ask output text.
   * Parses the record and creates a recommendation.
   */
  async ingestFromText(text: string) {
    const fields = this.parseStructuredRecord(text);
    if (!fields) {
      return { success: false, error: 'No valid RECOMMENDATION-RECORD found in text' };
    }

    const dto = this.fieldsToDto(fields);
    if (!dto) {
      return { success: false, error: 'Failed to convert fields to DTO' };
    }

    const analytics = this.buildAnalytics(fields);
    const recommendation = await this.recommendationService.create(dto, analytics);
    return { success: true, recommendation };
  }
}
