/* @lifecycle ACTIVE — Agent memory TypeScript enums and interfaces (TASK-029) */

export enum AgentType {
  ROUTER = 'ROUTER',
  PLAN = 'PLAN',
  ARCHITECT = 'ARCHITECT',
  CODE = 'CODE',
  PRE_VERIFY = 'PRE_VERIFY',
  POST_VERIFY = 'POST_VERIFY',
}

export enum MemoryOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  MIXED = 'MIXED',
  BLOCKED = 'BLOCKED',
  ABANDONED = 'ABANDONED',
}

export interface AgentMemoryEntry {
  id: string;
  memoryId: string;
  agentType: AgentType;
  taskType: string;
  context?: Record<string, unknown> | null;
  decision?: string | null;
  outcome: MemoryOutcome;
  success: boolean;
  confidence?: number | null;
  lessonsLearned: string[];
  sourceExecutionId?: string | null;
  sourcePhaseId?: string | null;
  domain?: string | null;
  technology?: string | null;
  projectId: string;
  applicabilityScore?: number | null;
  referenceCount: number;
  decayWeight: number;
  createdAt: Date;
  lastReferencedAt?: Date | null;
  expiresAt?: Date | null;
}

export interface MemoryQueryResult {
  memory: AgentMemoryEntry;
  similarity: number;
  outcomeWeight: number;
  applicabilityScore: number;
}

export interface PatternSummary {
  taskType: string;
  domain: string | null;
  totalCount: number;
  successCount: number;
  successRate: number;
}

export interface MemorySummary {
  totalMemories: number;
  byAgentType: Record<string, number>;
  activeMemories: number;
  staleMemories: number;
  perDomainBreakdown: Array<{
    domain: string;
    count: number;
    lastUpdated: Date | null;
  }>;
}
