/* @lifecycle ACTIVE — Memory similarity scoring weights config (TASK-029) */

export const MEMORY_SCORING_WEIGHTS = {
  agentType: 0.3,
  taskType: 0.2,
  domain: 0.15,
  exactContextMatch: 0.1,
  sameProject: 0.1,
  baseline: 0.15,
} as const;
