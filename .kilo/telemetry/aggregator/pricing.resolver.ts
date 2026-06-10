/* @lifecycle ACTIVE — Pricing resolver for cost aggregation (ADR-016) */

import { ModelPricing, PricingNotFoundError } from '../types';

export interface PricingResolver {
  resolve(model: string): ModelPricing | undefined;
}

/**
 * In-memory pricing resolver for Phase 2B.
 * Replace with ModelRegistry adapter in Phase 2C.
 */
export class InMemoryPricingResolver implements PricingResolver {
  private readonly pricing: Map<string, ModelPricing>;

  constructor(entries: ModelPricing[]) {
    this.pricing = new Map(entries.map(p => [p.model, p]));
  }

  resolve(model: string): ModelPricing | undefined {
    return this.pricing.get(model);
  }
}
