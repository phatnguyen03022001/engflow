/* @lifecycle ACTIVE — Core type definitions for context compiler IR (TASK-060) */

export type DependencyType = 'hard' | 'soft' | 'contextual';
export type Priority = 'low' | 'medium' | 'high';
export type AgentType =
  | 'router'
  | 'plan'
  | 'code'
  | 'debug'
  | 'ask'
  | 'architect-quick'
  | 'architect-deep'
  | 'pre_verify'
  | 'post_verify';

export interface NodeCost {
  self: number;
  cumulative: number;
  risk: number;
  density: number;
}

export interface RuleSection {
  id: string;
  source: string;
  title: string;
  headingNumber?: string;
  level: number;
  content: string;
  tokensEst: number;
  tags: string[];
  dependsOn?: string[];
  relevanceScore: number;
  priority: Priority;
  cost?: NodeCost;
}

export interface RuleFileAST {
  file: string;
  tags: string[];
  sections: RuleSection[];
}

export interface SectionRegistryIndex {
  files: RuleFileAST[];
  sectionCount: number;
  generatedAt: string;
}

export interface DependencyInference {
  sourceId: string;
  targetId: string;
  type: DependencyType;
  reason: string;
}

// ─── Legacy SectionGraph (backward compat) ────────────────────────

export interface SectionGraph {
  nodes: string[];
  edges: WeightedEdge[];
  stats: GraphStats;
  adjacency?: Map<string, { targetId: string; weight: number }[]>;
}

export interface WeightedEdge {
  sourceId: string;
  targetId: string;
  weight: number;
  costImpact: number;
  traversalCost: number;
  relation: 'depends_on' | 'references' | 'related';
  method: '§_reference' | 'file_reference' | 'constitution_ref' | 'tfidf_similarity' | 'title_keyword';
}

// ─── Dual-Graph Architecture ──────────────────────────────────────

export interface DualGraph {
  dependency: DependencyGraph;
  similarity: SimilarityGraph;
}

export interface DependencyGraph {
  nodes: string[];
  edges: DependencyEdge[];
  stats: GraphStats;
  adjacency?: Map<string, { targetId: string; weight: number }[]>;
}

export interface SimilarityGraph {
  nodes: string[];
  edges: SimilarityEdge[];
  stats: SimilarityStats;
  clusterCount?: number;
}

export interface DependencyEdge {
  sourceId: string;
  targetId: string;
  weight: number;
  relation: 'depends_on' | 'references';
  method: '§_reference' | 'file_reference' | 'constitution_ref';
  costImpact: number;
  traversalCost: number;
}

export interface SimilarityEdge {
  sourceId: string;
  targetId: string;
  weight: number;
  method: 'title_keyword' | 'tfidf_similarity';
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  density: number;
  avgEdgesPerNode: number;
  cycleCount: number;
  stronglyConnectedSize: number;
}

export interface SimilarityStats {
  nodeCount: number;
  edgeCount: number;
  density: number;
  avgEdgesPerNode: number;
}

// ─── Optimization Pipeline ─────────────────────────────────────────

export interface CostDelta {
  totalTokensBefore: number;
  totalTokensAfter: number;
  savings: number;           // before - after
  savingsPercent: number;    // relative savings (0-100)
  nodeReduction: number;     // nodes removed
  edgeReduction: number;     // edges removed
  riskDelta: number;         // change in risk (negative = improvement)
}

export interface PassDiagnostics {
  passName: string;
  durationMs: number;
  transformations: string[];  // human-readable log
  warnings: string[];
}

export interface OptimizationResult {
  graph: DependencyGraph;
  delta: CostDelta;
  diagnostics: PassDiagnostics;
}

export interface OptimizationPass {
  name: string;
  run(ir: DependencyGraph): OptimizationResult;
}

export interface OptimizationRunResult {
  graph: DependencyGraph;
  totalDelta: CostDelta;
  passResults: OptimizationResult[];
  rejectedPasses: string[];
  diagnostics: PipelineDiagnostics;
}

export interface PipelineDiagnostics {
  totalDurationMs: number;
  passOrder: string[];
  rollbackCount: number;
  netGainTokens: number;
  netRiskReduction: number;
}

// ─── Budget Controller ───────────────────────────────────────────

export type BudgetFailoverMode = 'soft' | 'medium' | 'hard';

export interface BudgetConfig {
  agent: AgentType;
  budget: number;
  failover: BudgetFailoverMode;
}

export interface BudgetCheckResult {
  status: 'ok' | 'overflow';
  totalCost: number;
  budget: number;
  excess: number;
  failover: BudgetFailoverMode;
  details: {
    staticCost: number;
    dynamicCost: number;
    overheadCost: number;
  };
  actions: string[];
}

// ─── Planner Types ───────────────────────────────────────────────

export interface PlannedSection {
  sectionId: string;
  relevanceScore: number;
  costScore?: number;
  cumulativeCost?: number;
}

// ─── FragmentRegistry Types ─────────────────────────────────────

export interface Fragment {
  id: string;
  content: string;
  tokens: number;
  usageCount: number;
  type: 'global_once' | 'shared' | 'agent_specific';
  amortizedCost: number;
  sourceAgents: string[];
  hash: string;
}

export interface FragmentRegistryResult {
  fragments: Fragment[];
  savings: FragmentSavings;
  mapping: Map<string, string[]>;
}

export interface FragmentSavings {
  rawCost: number;
  amortizedCost: number;
  savings: number;
  savingsPercent: number;
  fragmentCount: number;
}

export interface AgentPrompt {
  id: string;
  systemPrompt: string;
}

// ─── Agent Budget Map (from kilo.jsonc) ──────────────────────────

export const AGENT_BUDGETS: Record<AgentType, number> = {
  router: 400,
  plan: 3000,
  code: 4000,
  debug: 3500,
  ask: 1500,
  'architect-quick': 5000,
  'architect-deep': 8000,
  pre_verify: 2000,
  post_verify: 2000,
};
