/* @lifecycle ACTIVE — Telemetry pipeline orchestration (ADR-016) */

import { TelemetryEvent, CostBreakdown } from '../types';
import { CostAggregatorService } from '../aggregator/cost-aggregator.service';
import { PricingResolver } from '../aggregator/pricing.resolver';

export interface PipelineResult {
  eventsProcessed: number;
  costBreakdowns: CostBreakdown[];
}

export class TelemetryPipeline {
  constructor(
    private readonly aggregator: CostAggregatorService
  ) {}

  /**
   * Drain buffer, aggregate cost, return results.
   * Does NOT persist — caller is responsible for storage.
   */
  flush(events: TelemetryEvent[]): PipelineResult {
    if (events.length === 0) {
      return { eventsProcessed: 0, costBreakdowns: [] };
    }

    const costBreakdowns = this.aggregator.aggregate(events);

    return {
      eventsProcessed: events.length,
      costBreakdowns,
    };
  }
}
