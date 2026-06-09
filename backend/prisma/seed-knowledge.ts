/* @lifecycle GENERATED — Seed Knowledge Graph with modules, ADRs, and models */
// Run: npx tsx prisma/seed-knowledge.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/* ─── Definitions ───────────────────────────────────────────────────── */

interface NodeDef {
  nodeId: string;
  type: 'ARCHITECTURE' | 'DECISION' | 'CODE';
  label: string;
  description: string;
  sourceFile?: string;
  module?: string;
}

interface EdgeDef {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: 'DECIDES' | 'IMPLEMENTS' | 'REFERENCES';
  weight?: number;
  description?: string;
}

/* ─── 8 Module Nodes ───────────────────────────────────────────────── */

const MODULES: NodeDef[] = [
  {
    nodeId: 'mod:shared',
    type: 'ARCHITECTURE',
    label: 'Shared Module',
    description: 'Shared utilities, PrismaService, exception filters, interceptors, health checks, config',
    sourceFile: 'backend/src/shared/',
    module: 'shared',
  },
  {
    nodeId: 'mod:auth',
    type: 'ARCHITECTURE',
    label: 'Auth Module',
    description: 'Authentication and authorization — JWT guards, passport strategies',
    sourceFile: 'backend/src/auth/',
    module: 'auth',
  },
  {
    nodeId: 'mod:user',
    type: 'ARCHITECTURE',
    label: 'User Module',
    description: 'User management — CRUD, profile, admin endpoints',
    sourceFile: 'backend/src/user/',
    module: 'user',
  },
  {
    nodeId: 'mod:learning',
    type: 'ARCHITECTURE',
    label: 'Learning Module',
    description: 'Learning content — courses, lessons, exercises, progress tracking',
    sourceFile: 'backend/src/learning/',
    module: 'learning',
  },
  {
    nodeId: 'mod:recommendation',
    type: 'ARCHITECTURE',
    label: 'Recommendation Module',
    description: 'Recommendation registry (ADR-002), trust scores, accuracy snapshots, decision memory',
    sourceFile: 'backend/src/recommendation/',
    module: 'recommendation',
  },
  {
    nodeId: 'mod:evaluation',
    type: 'ARCHITECTURE',
    label: 'Evaluation Module',
    description: 'Agent evaluation harness (ADR-003), execution traces, metrics, drift detection, analytics',
    sourceFile: 'backend/src/evaluation/',
    module: 'evaluation',
  },
  {
    nodeId: 'mod:memory',
    type: 'ARCHITECTURE',
    label: 'Memory Module',
    description: 'Agent memory store, context manager, pattern retrieval',
    sourceFile: 'backend/src/memory/',
    module: 'memory',
  },
  {
    nodeId: 'mod:knowledge',
    type: 'ARCHITECTURE',
    label: 'Knowledge Module',
    description: 'Knowledge Graph (ADR-011) — cross-layer traceability, graph query engine, sync service',
    sourceFile: 'backend/src/knowledge/',
    module: 'knowledge',
  },
  {
    nodeId: 'mod:model-registry',
    type: 'ARCHITECTURE',
    label: 'Model Registry Module',
    description: 'Model intelligence (ADR-010) — model catalog, routing rules, fallback chains, cost tracking',
    sourceFile: 'backend/src/model-registry/',
    module: 'model-registry',
  },
];

/* ─── 10 ADR Nodes ──────────────────────────────────────────────────── */

const ADRS: NodeDef[] = [
  {
    nodeId: 'adr:001',
    type: 'DECISION',
    label: 'ADR-001',
    description: 'Reuse-First Governance Framework — five-level reuse hierarchy, build justification',
    sourceFile: 'docs/decisions/001-reuse-framework.md',
  },
  {
    nodeId: 'adr:002',
    type: 'DECISION',
    label: 'ADR-002',
    description: 'Ask Agent as Virtual CTO Advisor — Bayesian trust scores, decision memory',
    sourceFile: 'docs/decisions/002-ask-agent-advisor.md',
  },
  {
    nodeId: 'adr:003',
    type: 'DECISION',
    label: 'ADR-003',
    description: 'Agent Evaluation Harness — execution trace recording, metric computation',
    sourceFile: 'docs/decisions/003-evaluation-harness.md',
  },
  {
    nodeId: 'adr:008',
    type: 'DECISION',
    label: 'ADR-008',
    description: 'Lifecycle Declarations — 5-state lifecycle system for file governance',
    sourceFile: 'docs/decisions/008-lifecycle-declarations.md',
  },
  {
    nodeId: 'adr:009',
    type: 'DECISION',
    label: 'ADR-009',
    description: 'Prisma v6 Upgrade + UUID v7 — migration from Prisma 5.x and UUID v4 to v7',
    sourceFile: 'docs/decisions/009-prisma-uuid-v7.md',
  },
  {
    nodeId: 'adr:010',
    type: 'DECISION',
    label: 'ADR-010',
    description: 'Model Intelligence & Cost Tracking — model registry, routing, fallback, cost tracking',
    sourceFile: 'docs/decisions/010-model-intelligence.md',
  },
  {
    nodeId: 'adr:011',
    type: 'DECISION',
    label: 'ADR-011',
    description: 'Knowledge Graph Design — PostgreSQL JSONB graph for cross-layer traceability',
    sourceFile: 'docs/decisions/011-knowledge-graph.md',
  },
  {
    nodeId: 'adr:012',
    type: 'DECISION',
    label: 'ADR-012',
    description: 'Context Manager Architecture — multi-source context assembly with token budgets',
    sourceFile: 'docs/decisions/012-context-manager.md',
  },
  {
    nodeId: 'adr:013',
    type: 'DECISION',
    label: 'ADR-013',
    description: 'Drift Detection — cron-based architecture and policy compliance monitoring',
    sourceFile: 'docs/decisions/013-drift-detection.md',
  },
  {
    nodeId: 'adr:014',
    type: 'DECISION',
    label: 'ADR-014',
    description: 'Analytics Dashboard — unified analytics within evaluation module',
    sourceFile: 'docs/decisions/014-analytics-dashboard.md',
  },
];

/* ─── 20 Prisma Model Nodes ─────────────────────────────────────────── */

const MODELS: NodeDef[] = [
  { nodeId: 'model:User',            type: 'CODE', label: 'User',           description: 'User accounts and authentication',                              sourceFile: 'backend/prisma/schema.prisma', module: 'user' },
  { nodeId: 'model:Lesson',          type: 'CODE', label: 'Lesson',         description: 'Learning lesson with difficulty tiers',                         sourceFile: 'backend/prisma/schema.prisma', module: 'learning' },
  { nodeId: 'model:Exercise',        type: 'CODE', label: 'Exercise',       description: 'Lesson exercises — multiple choice, answers',                    sourceFile: 'backend/prisma/schema.prisma', module: 'learning' },
  { nodeId: 'model:UserLesson',      type: 'CODE', label: 'UserLesson',     description: 'User progress on lessons — completion, score',                   sourceFile: 'backend/prisma/schema.prisma', module: 'learning' },
  { nodeId: 'model:Recommendation',  type: 'CODE', label: 'Recommendation', description: 'Recommendation registry — options, scoring, outcome tracking', sourceFile: 'backend/prisma/schema.prisma', module: 'recommendation' },
  { nodeId: 'model:RecommendationOption', type: 'CODE', label: 'RecommendationOption', description: 'Individual options within a recommendation', sourceFile: 'backend/prisma/schema.prisma', module: 'recommendation' },
  { nodeId: 'model:Checkpoint',      type: 'CODE', label: 'Checkpoint',     description: 'Recommendation checkpoints — evaluation, outcome, risk validation', sourceFile: 'backend/prisma/schema.prisma', module: 'recommendation' },
  { nodeId: 'model:TrustScore',      type: 'CODE', label: 'TrustScore',     description: 'Bayesian trust scores per level/domain/decision type',         sourceFile: 'backend/prisma/schema.prisma', module: 'recommendation' },
  { nodeId: 'model:AccuracySnapshot',type: 'CODE', label: 'AccuracySnapshot', description: 'Periodic recommendation accuracy snapshots',                    sourceFile: 'backend/prisma/schema.prisma', module: 'recommendation' },
  { nodeId: 'model:AgentMemory',     type: 'CODE', label: 'AgentMemory',    description: 'Agent memory entries with scoring and decay',                     sourceFile: 'backend/prisma/schema.prisma', module: 'memory' },
  { nodeId: 'model:DecisionMemory',  type: 'CODE', label: 'DecisionMemory', description: 'Deprecated decision memory — migrated to AgentMemory',            sourceFile: 'backend/prisma/schema.prisma', module: 'memory' },
  { nodeId: 'model:AgentExecution',  type: 'CODE', label: 'AgentExecution', description: 'Agent execution traces — routing, planning, outcomes',            sourceFile: 'backend/prisma/schema.prisma', module: 'evaluation' },
  { nodeId: 'model:ExecutionPhase',  type: 'CODE', label: 'ExecutionPhase', description: 'Individual phases within an agent execution',                     sourceFile: 'backend/prisma/schema.prisma', module: 'evaluation' },
  { nodeId: 'model:AgentMetric',     type: 'CODE', label: 'AgentMetric',    description: 'Computed agent performance metrics with confidence intervals',   sourceFile: 'backend/prisma/schema.prisma', module: 'evaluation' },
  { nodeId: 'model:MetricDimension', type: 'CODE', label: 'MetricDimension', description: 'Dimension breakdowns for agent metrics',                         sourceFile: 'backend/prisma/schema.prisma', module: 'evaluation' },
  { nodeId: 'model:ModelProvider',   type: 'CODE', label: 'ModelProvider',  description: 'AI model providers — API endpoints, keys',                       sourceFile: 'backend/prisma/schema.prisma', module: 'model-registry' },
  { nodeId: 'model:ModelRegistry',   type: 'CODE', label: 'ModelRegistry',  description: 'AI model catalog — tiers, capabilities, cost, quality',          sourceFile: 'backend/prisma/schema.prisma', module: 'model-registry' },
  { nodeId: 'model:ModelRoute',      type: 'CODE', label: 'ModelRoute',     description: 'Agent→model routing rules with priorities',                      sourceFile: 'backend/prisma/schema.prisma', module: 'model-registry' },
  { nodeId: 'model:FallbackChain',   type: 'CODE', label: 'FallbackChain',  description: 'Model fallback chains — failover when primary model fails',       sourceFile: 'backend/prisma/schema.prisma', module: 'model-registry' },
  { nodeId: 'model:CostLog',         type: 'CODE', label: 'CostLog',        description: 'Per-request cost tracking — tokens, latency, fallback status',    sourceFile: 'backend/prisma/schema.prisma', module: 'model-registry' },
  { nodeId: 'model:KnowledgeNode',   type: 'CODE', label: 'KnowledgeNode',  description: 'Knowledge Graph nodes — requirements, architecture, code, tests', sourceFile: 'backend/prisma/schema.prisma', module: 'knowledge' },
  { nodeId: 'model:KnowledgeEdge',   type: 'CODE', label: 'KnowledgeEdge',  description: 'Knowledge Graph edges typed relations between nodes',            sourceFile: 'backend/prisma/schema.prisma', module: 'knowledge' },
  { nodeId: 'model:DriftEvent',      type: 'CODE', label: 'DriftEvent',     description: 'Drift detection events — structure, policy, API contract drifts', sourceFile: 'backend/prisma/schema.prisma', module: 'evaluation' },
];

/* ─── Edges ─────────────────────────────────────────────────────────── */

const EDGES: EdgeDef[] = [
  // Module → ADR (DECIDES)
  { edgeId: 'e:shared:adr008', sourceNodeId: 'mod:shared',       targetNodeId: 'adr:008', type: 'DECIDES', description: 'Shared module implements lifecycle declarations per ADR-008' },
  { edgeId: 'e:shared:adr009', sourceNodeId: 'mod:shared',       targetNodeId: 'adr:009', type: 'DECIDES', description: 'Shared PrismaService uses Prisma v6 + UUID v7 per ADR-009' },
  { edgeId: 'e:auth:adr002',   sourceNodeId: 'mod:auth',         targetNodeId: 'adr:002', type: 'DECIDES', description: 'Auth guards used by Ask agent recommendation system' },
  { edgeId: 'e:recommendation:adr002', sourceNodeId: 'mod:recommendation', targetNodeId: 'adr:002', type: 'DECIDES', description: 'Recommendation registry implements ADR-002' },
  { edgeId: 'e:evaluation:adr003', sourceNodeId: 'mod:evaluation', targetNodeId: 'adr:003', type: 'DECIDES', description: 'Evaluation harness implements ADR-003' },
  { edgeId: 'e:knowledge:adr011', sourceNodeId: 'mod:knowledge', targetNodeId: 'adr:011', type: 'DECIDES', description: 'Knowledge Graph implements ADR-011' },
  { edgeId: 'e:evaluation:adr011', sourceNodeId: 'mod:evaluation', targetNodeId: 'adr:011', type: 'REFERENCES', description: 'Evaluation module links drift events to Knowledge Graph' },
  { edgeId: 'e:memory:adr012', sourceNodeId: 'mod:memory',       targetNodeId: 'adr:012', type: 'DECIDES', description: 'Context Manager implements ADR-012' },
  { edgeId: 'e:evaluation:adr013', sourceNodeId: 'mod:evaluation', targetNodeId: 'adr:013', type: 'DECIDES', description: 'Drift detection implements ADR-013' },
  { edgeId: 'e:evaluation:adr014', sourceNodeId: 'mod:evaluation', targetNodeId: 'adr:014', type: 'DECIDES', description: 'Analytics dashboard implements ADR-014' },

  // Module → Model (IMPLEMENTS)
  { edgeId: 'e:user:modelUser',  sourceNodeId: 'mod:user',        targetNodeId: 'model:User',          type: 'IMPLEMENTS' },
  { edgeId: 'e:learning:modelLesson', sourceNodeId: 'mod:learning', targetNodeId: 'model:Lesson',      type: 'IMPLEMENTS' },
  { edgeId: 'e:learning:modelExercise', sourceNodeId: 'mod:learning', targetNodeId: 'model:Exercise', type: 'IMPLEMENTS' },
  { edgeId: 'e:learning:modelUserLesson', sourceNodeId: 'mod:learning', targetNodeId: 'model:UserLesson', type: 'IMPLEMENTS' },
  { edgeId: 'e:recommendation:modelRec', sourceNodeId: 'mod:recommendation', targetNodeId: 'model:Recommendation', type: 'IMPLEMENTS' },
  { edgeId: 'e:recommendation:modelRecOpt', sourceNodeId: 'mod:recommendation', targetNodeId: 'model:RecommendationOption', type: 'IMPLEMENTS' },
  { edgeId: 'e:recommendation:modelCheckpoint', sourceNodeId: 'mod:recommendation', targetNodeId: 'model:Checkpoint', type: 'IMPLEMENTS' },
  { edgeId: 'e:recommendation:modelTrust', sourceNodeId: 'mod:recommendation', targetNodeId: 'model:TrustScore', type: 'IMPLEMENTS' },
  { edgeId: 'e:recommendation:modelAccuracy', sourceNodeId: 'mod:recommendation', targetNodeId: 'model:AccuracySnapshot', type: 'IMPLEMENTS' },
  { edgeId: 'e:memory:modelAgentMem', sourceNodeId: 'mod:memory', targetNodeId: 'model:AgentMemory', type: 'IMPLEMENTS' },
  { edgeId: 'e:memory:modelDecisionMem', sourceNodeId: 'mod:memory', targetNodeId: 'model:DecisionMemory', type: 'IMPLEMENTS' },
  { edgeId: 'e:evaluation:modelExec', sourceNodeId: 'mod:evaluation', targetNodeId: 'model:AgentExecution', type: 'IMPLEMENTS' },
  { edgeId: 'e:evaluation:modelPhase', sourceNodeId: 'mod:evaluation', targetNodeId: 'model:ExecutionPhase', type: 'IMPLEMENTS' },
  { edgeId: 'e:evaluation:modelMetric', sourceNodeId: 'mod:evaluation', targetNodeId: 'model:AgentMetric', type: 'IMPLEMENTS' },
  { edgeId: 'e:evaluation:modelMetricDim', sourceNodeId: 'mod:evaluation', targetNodeId: 'model:MetricDimension', type: 'IMPLEMENTS' },
  { edgeId: 'e:evaluation:modelDrift', sourceNodeId: 'mod:evaluation', targetNodeId: 'model:DriftEvent', type: 'IMPLEMENTS' },
  { edgeId: 'e:modelReg:modelProvider', sourceNodeId: 'mod:model-registry', targetNodeId: 'model:ModelProvider', type: 'IMPLEMENTS' },
  { edgeId: 'e:modelReg:modelRegistry', sourceNodeId: 'mod:model-registry', targetNodeId: 'model:ModelRegistry', type: 'IMPLEMENTS' },
  { edgeId: 'e:modelReg:modelRoute', sourceNodeId: 'mod:model-registry', targetNodeId: 'model:ModelRoute', type: 'IMPLEMENTS' },
  { edgeId: 'e:modelReg:modelFallback', sourceNodeId: 'mod:model-registry', targetNodeId: 'model:FallbackChain', type: 'IMPLEMENTS' },
  { edgeId: 'e:modelReg:modelCostLog', sourceNodeId: 'mod:model-registry', targetNodeId: 'model:CostLog', type: 'IMPLEMENTS' },
  { edgeId: 'e:knowledge:modelKN', sourceNodeId: 'mod:knowledge', targetNodeId: 'model:KnowledgeNode', type: 'IMPLEMENTS' },
  { edgeId: 'e:knowledge:modelKE', sourceNodeId: 'mod:knowledge', targetNodeId: 'model:KnowledgeEdge', type: 'IMPLEMENTS' },

  // Model → Model (REFERENCES) — based on foreign key relationships
  { edgeId: 'e:ref:lesson:exercise', sourceNodeId: 'model:Lesson', targetNodeId: 'model:Exercise', type: 'REFERENCES', description: 'Lesson has many Exercise records' },
  { edgeId: 'e:ref:lesson:userLesson', sourceNodeId: 'model:Lesson', targetNodeId: 'model:UserLesson', type: 'REFERENCES', description: 'Lesson has many UserLesson progress records' },
  { edgeId: 'e:ref:user:userLesson', sourceNodeId: 'model:User', targetNodeId: 'model:UserLesson', type: 'REFERENCES', description: 'User has many UserLesson progress records' },
  { edgeId: 'e:ref:rec:recOption', sourceNodeId: 'model:Recommendation', targetNodeId: 'model:RecommendationOption', type: 'REFERENCES', description: 'Recommendation has many options' },
  { edgeId: 'e:ref:rec:checkpoint', sourceNodeId: 'model:Recommendation', targetNodeId: 'model:Checkpoint', type: 'REFERENCES', description: 'Recommendation has many checkpoints' },
  { edgeId: 'e:ref:exec:phase', sourceNodeId: 'model:AgentExecution', targetNodeId: 'model:ExecutionPhase', type: 'REFERENCES', description: 'AgentExecution has many ExecutionPhases' },
  { edgeId: 'e:ref:metric:dimension', sourceNodeId: 'model:AgentMetric', targetNodeId: 'model:MetricDimension', type: 'REFERENCES', description: 'AgentMetric has many MetricDimensions' },
  { edgeId: 'e:ref:provider:registry', sourceNodeId: 'model:ModelProvider', targetNodeId: 'model:ModelRegistry', type: 'REFERENCES', description: 'ModelProvider has many ModelRegistry entries' },
  { edgeId: 'e:ref:registry:route', sourceNodeId: 'model:ModelRegistry', targetNodeId: 'model:ModelRoute', type: 'REFERENCES', description: 'ModelRegistry is referenced by ModelRoute' },
  { edgeId: 'e:ref:registry:fallback', sourceNodeId: 'model:ModelRegistry', targetNodeId: 'model:FallbackChain', type: 'REFERENCES', description: 'ModelRegistry is referenced by FallbackChain as primary/fallback' },
  { edgeId: 'e:ref:registry:costLog', sourceNodeId: 'model:ModelRegistry', targetNodeId: 'model:CostLog', type: 'REFERENCES', description: 'ModelRegistry has many CostLog entries' },
  { edgeId: 'e:ref:kn:ke', sourceNodeId: 'model:KnowledgeNode', targetNodeId: 'model:KnowledgeEdge', type: 'REFERENCES', description: 'KnowledgeNode is source/target of KnowledgeEdges' },
  { edgeId: 'e:ref:rec:agentExec', sourceNodeId: 'model:Recommendation', targetNodeId: 'model:AgentExecution', type: 'REFERENCES', description: 'Recommendations may reference AgentExecution traces' },
  { edgeId: 'e:ref:agentExec:agentMem', sourceNodeId: 'model:AgentExecution', targetNodeId: 'model:AgentMemory', type: 'REFERENCES', description: 'AgentExecution creates AgentMemory entries' },
];

/* ─── Main ──────────────────────────────────────────────────────────── */

async function main() {
  console.log('🧠 Seeding Knowledge Graph...\n');

  let nodesCreated = 0;
  let edgesCreated = 0;

  // ─── Upsert all nodes ────────────────────────────────────────────────

  const allNodes = [...MODULES, ...ADRS, ...MODELS];
  for (const node of allNodes) {
    await prisma.knowledgeNode.upsert({
      where: { nodeId: node.nodeId },
      update: {
        label: node.label,
        description: node.description,
        sourceFile: node.sourceFile ?? null,
        module: node.module ?? null,
        isActive: true,
      },
      create: {
        nodeId: node.nodeId,
        type: node.type,
        label: node.label,
        description: node.description,
        sourceFile: node.sourceFile ?? null,
        module: node.module ?? null,
        isActive: true,
      },
    });
    nodesCreated++;
  }

  // ─── Upsert all edges ────────────────────────────────────────────────

  for (const edge of EDGES) {
    // Verify both endpoints exist
    const source = await prisma.knowledgeNode.findUnique({ where: { nodeId: edge.sourceNodeId } });
    const target = await prisma.knowledgeNode.findUnique({ where: { nodeId: edge.targetNodeId } });

    if (!source) {
      console.warn(`  ⚠️  Source node "${edge.sourceNodeId}" not found — skipping edge "${edge.edgeId}"`);
      continue;
    }
    if (!target) {
      console.warn(`  ⚠️  Target node "${edge.targetNodeId}" not found — skipping edge "${edge.edgeId}"`);
      continue;
    }

    await prisma.knowledgeEdge.upsert({
      where: { edgeId: edge.edgeId },
      update: {
        weight: edge.weight ?? 1.0,
        description: edge.description ?? null,
      },
      create: {
        edgeId: edge.edgeId,
        sourceNodeId: source.id,
        targetNodeId: target.id,
        type: edge.type,
        weight: edge.weight ?? 1.0,
        description: edge.description ?? null,
      },
    });
    edgesCreated++;
  }

  // ─── Report ──────────────────────────────────────────────────────────

  const totalNodes = await prisma.knowledgeNode.count();
  const totalEdges = await prisma.knowledgeEdge.count();

  console.log('\n📊 Knowledge Graph seeded successfully!');
  console.log(`   Nodes created/updated: ${nodesCreated} (total in DB: ${totalNodes})`);
  console.log(`   Edges created/updated: ${edgesCreated} (total in DB: ${totalEdges})`);
  console.log(`   Modules: ${MODULES.length}`);
  console.log(`   ADRs:    ${ADRS.length}`);
  console.log(`   Models:  ${MODELS.length}`);
  console.log(`   Edges:   ${EDGES.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  prisma.$disconnect();
  process.exit(1);
});
