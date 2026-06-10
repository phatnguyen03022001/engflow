/* @lifecycle ACTIVE — Pure cost aggregation service (ADR-016) */

import { TelemetryEvent, CostBreakdown, ModelPricing, PricingNotFoundError } from '../types';
import { PricingResolver } from './pricing.resolver';

export class CostAggregatorService {
  constructor(
    private readonly pricingResolver: PricingResolver
  ) {}

  aggregate(events: TelemetryEvent[]): CostBreakdown[] {
    return events.map(event => {
      const pricing = this.pricingResolver.resolve(event.modelUsed);
      if (!pricing) {
        throw new PricingNotFoundError(event.modelUsed);
      }

      const inputCost = (event.tokens.input / 1000) * pricing.inputPer1k;
      const outputCost = (event.tokens.output / 1000) * pricing.outputPer1k;

      return {
        eventId: event.eventId,
        model: event.modelUsed,
        inputTokens: event.tokens.input,
        outputTokens: event.tokens.output,
        inputCostUsd: inputCost,
        outputCostUsd: outputCost,
        totalCostUsd: inputCost + outputCost,
      };
    });
  }
}
