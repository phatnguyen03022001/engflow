/* @lifecycle ACTIVE — Context manager TypeScript types and enums (ADR-012) */

export enum ContextTier {
  TIER_1 = 'TIER_1',
  TIER_2 = 'TIER_2',
  TIER_3 = 'TIER_3',
}

export const TIER_BUDGETS: Record<ContextTier, number> = {
  [ContextTier.TIER_1]: 8_000,
  [ContextTier.TIER_2]: 16_000,
  [ContextTier.TIER_3]: 32_000,
};

export const TIER_LABELS: Record<ContextTier, string> = {
  [ContextTier.TIER_1]: '8K — core memories only',
  [ContextTier.TIER_2]: '16K — + Knowledge Graph',
  [ContextTier.TIER_3]: '32K — + Rules + ADRs',
};

/** A single context fragment contributed by one of the four sources. */
export interface ContextFragment {
  source: 'agent_memory' | 'knowledge_graph' | 'rules' | 'architecture';
  title: string;
  content: string;
  tokenEstimate: number;
}

/** Result returned by ContextManagerService.assemble() */
export interface AssembledContext {
  sessionId: string;
  agentType: string;
  taskType: string;
  tier: ContextTier;
  fragments: ContextFragment[];
  combined: string;
  totalTokens: number;
  budget: number;
  truncated: boolean;
  assembledAt: string;
}
