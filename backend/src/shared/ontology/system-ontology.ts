/* @lifecycle ACTIVE — Semantic ontology: shared domain types for Phase A binding */
/* @tags shared, ontology */

/**
 * Canonical agent types — re-exported from memory module.
 * Single source of truth for the agent taxonomy.
 */
export { AgentType } from '../../memory/interfaces/agent-memory.interface';

/**
 * Canonical system modules for knowledge graph context binding.
 *
 * Ontologically distinct from LEVEL_1/LEVEL_2/LEVEL_3 routing tokens.
 * - LEVEL_1 → "shared" (legacy KG routing token, preserved)
 * - LEVEL_3 → "architecture" (legacy KG routing token, preserved)
 * - Module-qualified types (e.g. LEVEL_2:evaluation) bind via SystemModule.
 */
export enum SystemModule {
  AUTH = 'auth',
  EVALUATION = 'evaluation',
  MEMORY = 'memory',
  KNOWLEDGE = 'knowledge',
  DRIFT = 'drift',
  ANALYTICS = 'analytics',
  USER = 'user',
  LEARNING = 'learning',
  RECOMMENDATION = 'recommendation',
  MODEL_REGISTRY = 'model_registry',
}

/**
 * Drift event types, aligned with DriftDetectorService detector types.
 */
export enum SystemEventType {
  STRUCTURE = 'STRUCTURE',
  POLICY = 'POLICY',
  API_CONTRACT = 'API_CONTRACT',
}

/**
 * Generic pagination query interface.
 * Used across analytics, evaluation, and knowledge graph queries.
 */
export interface PaginationQuery {
  /** Number of records to skip. */
  skip?: number;
  /** Number of records to return (max 100). */
  take?: number;
}
