// @lifecycle TEMPORARY — Seed script for agent evaluation harness (ADR-003)
// Run: npx ts-node prisma/seed-evaluations.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PhaseSeed {
  phaseId: string;
  agentType: string;
  phaseOrder: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  decision?: string;
  decisionReason?: string;
  durationMs?: number;
  modelUsed?: string;
  transitionedTo?: string;
}

interface ExecutionSeed {
  executionId: string;
  requestSummary: string;
  routerRoute: string;
  routerConfidence: number;
  routerRisk: string;
  routerReason: string;
  planSummary: string | null;
  planTaskCount: number | null;
  archReviewed: boolean;
  archRevisionNeeded: boolean;
  preVerifyDecision: string | null;
  preVerifyFlags?: string[];
  codeAttempts: number;
  codeFirstAttemptSuccess: boolean | null;
  postVerifyDecision: string | null;
  postVerifyIssues?: string[];
  retryCount: number;
  debugSuccess: boolean | null;
  finalOutcome: string;
  totalDurationMs: number | null;
  committedAt: string | null;
  phases: PhaseSeed[];
}

const seedData: ExecutionSeed[] = [
  // ─── Historical: TASK-A (LEVEL_1, verify tests, success) ──────────────────
  {
    executionId: 'TASK-A',
    requestSummary: 'Verify existing tests pass and add missing tests for recommendation module',
    routerRoute: 'LEVEL_1',
    routerConfidence: 0.95,
    routerRisk: 'low',
    routerReason: 'Clear test task with well-defined scope. No architectural decisions needed.',
    planSummary: null,
    planTaskCount: null,
    archReviewed: false,
    archRevisionNeeded: false,
    preVerifyDecision: null,
    codeAttempts: 1,
    codeFirstAttemptSuccess: true,
    postVerifyDecision: 'PASS',
    retryCount: 0,
    debugSuccess: null,
    finalOutcome: 'COMMITTED',
    totalDurationMs: 45000,
    committedAt: '2026-01-15T10:30:00Z',
    phases: [
      { phaseId: 'TASK-A-ROUTER', agentType: 'ROUTER', phaseOrder: 1, decision: 'LEVEL_1', durationMs: 500, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'CODE' },
      { phaseId: 'TASK-A-CODE', agentType: 'CODE', phaseOrder: 2, durationMs: 35000, modelUsed: 'deepseek/deepseek-v4-flash', decision: 'PASS', transitionedTo: 'POST_VERIFY' },
      { phaseId: 'TASK-A-POSTVERIFY', agentType: 'POST_VERIFY', phaseOrder: 3, decision: 'PASS', durationMs: 5000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'COMMIT' },
    ],
  },

  // ─── Historical: TASK-001 (LEVEL_3, MVP scaffold, full pipeline) ──────────
  {
    executionId: 'TASK-001',
    requestSummary: 'Scaffold MVP backend with NestJS, Prisma, PostgreSQL, Docker, and DevContainer',
    routerRoute: 'LEVEL_3',
    routerConfidence: 0.85,
    routerRisk: 'medium',
    routerReason: 'Greenfield project setup with multiple architectural decisions (DB, ORM, containerization). Requires planning.',
    planSummary: 'MVP scaffold with 5 tasks: NestJS setup, Prisma schema, Docker config, DevContainer, health endpoint',
    planTaskCount: 5,
    archReviewed: true,
    archRevisionNeeded: false,
    preVerifyDecision: 'PASS',
    codeAttempts: 1,
    codeFirstAttemptSuccess: true,
    postVerifyDecision: 'PASS',
    retryCount: 0,
    debugSuccess: null,
    finalOutcome: 'COMMITTED',
    totalDurationMs: 180000,
    committedAt: '2026-01-20T15:00:00Z',
    phases: [
      { phaseId: 'TASK-001-ROUTER', agentType: 'ROUTER', phaseOrder: 1, decision: 'LEVEL_3', durationMs: 800, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PLAN' },
      { phaseId: 'TASK-001-PLAN', agentType: 'PLAN', phaseOrder: 2, decision: 'PASS', decisionReason: 'Feasible plan', durationMs: 25000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'ARCH' },
      { phaseId: 'TASK-001-ARCH', agentType: 'ARCHITECT', phaseOrder: 3, decision: 'PASS', decisionReason: 'Architecture approved', durationMs: 30000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PRE_VERIFY' },
      { phaseId: 'TASK-001-PREVERIFY', agentType: 'PRE_VERIFY', phaseOrder: 4, decision: 'PASS', durationMs: 5000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'CODE' },
      { phaseId: 'TASK-001-CODE', agentType: 'CODE', phaseOrder: 5, durationMs: 100000, modelUsed: 'deepseek/deepseek-v4-flash', decision: 'PASS', transitionedTo: 'POST_VERIFY' },
      { phaseId: 'TASK-001-POSTVERIFY', agentType: 'POST_VERIFY', phaseOrder: 6, decision: 'PASS', durationMs: 10000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'COMMIT' },
    ],
  },

  // ─── Historical: TASK-021 (LEVEL_2, migration+API verify) ─────────────────
  {
    executionId: 'TASK-021',
    requestSummary: 'Implement Prisma migration and verify API endpoints for recommendation registry v2',
    routerRoute: 'LEVEL_2',
    routerConfidence: 0.88,
    routerRisk: 'low',
    routerReason: 'Enhancement with clear schema changes. Needs planning for migration strategy but well-understood.',
    planSummary: 'Migration plan with 3 tasks: schema update, migration script, API tests',
    planTaskCount: 3,
    archReviewed: false,
    archRevisionNeeded: false,
    preVerifyDecision: 'PASS',
    codeAttempts: 1,
    codeFirstAttemptSuccess: true,
    postVerifyDecision: 'PASS',
    retryCount: 0,
    debugSuccess: null,
    finalOutcome: 'COMMITTED',
    totalDurationMs: 90000,
    committedAt: '2026-03-10T14:00:00Z',
    phases: [
      { phaseId: 'TASK-021-ROUTER', agentType: 'ROUTER', phaseOrder: 1, decision: 'LEVEL_2', durationMs: 600, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PLAN' },
      { phaseId: 'TASK-021-PLAN', agentType: 'PLAN', phaseOrder: 2, decision: 'PASS', durationMs: 15000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PRE_VERIFY' },
      { phaseId: 'TASK-021-PREVERIFY', agentType: 'PRE_VERIFY', phaseOrder: 3, decision: 'PASS', durationMs: 4000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'CODE' },
      { phaseId: 'TASK-021-CODE', agentType: 'CODE', phaseOrder: 4, durationMs: 50000, modelUsed: 'deepseek/deepseek-v4-flash', decision: 'PASS', transitionedTo: 'POST_VERIFY' },
      { phaseId: 'TASK-021-POSTVERIFY', agentType: 'POST_VERIFY', phaseOrder: 5, decision: 'PASS', durationMs: 8000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'COMMIT' },
      { phaseId: 'TASK-021-FINAL', agentType: 'CODE', phaseOrder: 6, durationMs: 5000, modelUsed: 'deepseek/deepseek-v4-flash' },
    ],
  },

  // ─── Historical: TASK-022 (LEVEL_2, seed+bug fixes, revision+retry) ───────
  {
    executionId: 'TASK-022',
    requestSummary: 'Seed recommendation data and fix JSONB null bug in Prisma upsert',
    routerRoute: 'LEVEL_2',
    routerConfidence: 0.82,
    routerRisk: 'medium',
    routerReason: 'Bug fix with seed data. Needs planning for data migration but debug risk is moderate.',
    planSummary: 'Plan with 2 tasks: seed script, fix JSONB null bug',
    planTaskCount: 2,
    archReviewed: true,
    archRevisionNeeded: true,
    preVerifyDecision: 'FLAG',
    preVerifyFlags: ['arch_revision_needed', 'plan_scope_mismatch'],
    codeAttempts: 2,
    codeFirstAttemptSuccess: false,
    postVerifyDecision: 'PASS',
    postVerifyIssues: ['jsonb_null_fixed'],
    retryCount: 1,
    debugSuccess: true,
    finalOutcome: 'COMMITTED',
    totalDurationMs: 210000,
    committedAt: '2026-04-05T16:30:00Z',
    phases: [
      { phaseId: 'TASK-022-ROUTER', agentType: 'ROUTER', phaseOrder: 1, decision: 'LEVEL_2', durationMs: 700, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PLAN' },
      { phaseId: 'TASK-022-PLAN', agentType: 'PLAN', phaseOrder: 2, decision: 'FLAG', decisionReason: 'Plan scope needs adjustment', durationMs: 18000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'ARCH' },
      { phaseId: 'TASK-022-ARCH', agentType: 'ARCHITECT', phaseOrder: 3, decision: 'REVISION_NEEDED', decisionReason: 'Seed data approach needs revision', durationMs: 25000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PLAN' },
      { phaseId: 'TASK-022-PLAN-REV', agentType: 'PLAN', phaseOrder: 4, decision: 'PASS', decisionReason: 'Revised plan approved', durationMs: 10000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PRE_VERIFY' },
      { phaseId: 'TASK-022-PREVERIFY', agentType: 'PRE_VERIFY', phaseOrder: 5, decision: 'FLAG', decisionReason: 'Minor concerns noted', durationMs: 6000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'CODE' },
      { phaseId: 'TASK-022-CODE-1', agentType: 'CODE', phaseOrder: 6, durationMs: 60000, modelUsed: 'deepseek/deepseek-v4-flash', decision: 'FAIL', decisionReason: 'JSONB null bug found', transitionedTo: 'DEBUG' },
      { phaseId: 'TASK-022-DEBUG', agentType: 'CODE', phaseOrder: 7, durationMs: 45000, modelUsed: 'deepseek/deepseek-v4-flash', decision: 'FIXED', decisionReason: 'Fixed null issue', transitionedTo: 'POST_VERIFY' },
      { phaseId: 'TASK-022-POSTVERIFY', agentType: 'POST_VERIFY', phaseOrder: 8, decision: 'PASS', durationMs: 10000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'COMMIT' },
    ],
  },

  // ─── Synthetic: SYNTH-001 (LEVEL_1, simple CRUD, success) ─────────────────
  {
    executionId: 'SYNTH-001',
    requestSummary: 'Add simple CRUD endpoints for a new "tags" entity',
    routerRoute: 'LEVEL_1',
    routerConfidence: 0.97,
    routerRisk: 'low',
    routerReason: 'Standard CRUD pattern, no architectural decisions needed.',
    planSummary: null,
    planTaskCount: null,
    archReviewed: false,
    archRevisionNeeded: false,
    preVerifyDecision: null,
    codeAttempts: 1,
    codeFirstAttemptSuccess: true,
    postVerifyDecision: 'PASS',
    retryCount: 0,
    debugSuccess: null,
    finalOutcome: 'COMMITTED',
    totalDurationMs: 30000,
    committedAt: '2026-05-01T09:00:00Z',
    phases: [
      { phaseId: 'SYNTH-001-ROUTER', agentType: 'ROUTER', phaseOrder: 1, decision: 'LEVEL_1', durationMs: 400, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'CODE' },
      { phaseId: 'SYNTH-001-CODE', agentType: 'CODE', phaseOrder: 2, durationMs: 22000, modelUsed: 'deepseek/deepseek-v4-flash', decision: 'PASS', transitionedTo: 'POST_VERIFY' },
      { phaseId: 'SYNTH-001-POSTVERIFY', agentType: 'POST_VERIFY', phaseOrder: 3, decision: 'PASS', durationMs: 4000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'COMMIT' },
    ],
  },

  // ─── Synthetic: SYNTH-002 (LEVEL_1, bug fix, first attempt fails, retry) ──
  {
    executionId: 'SYNTH-002',
    requestSummary: 'Fix race condition in WebSocket connection handler',
    routerRoute: 'LEVEL_1',
    routerConfidence: 0.90,
    routerRisk: 'low',
    routerReason: 'Bug fix in specific handler, well-understood issue.',
    planSummary: null,
    planTaskCount: null,
    archReviewed: false,
    archRevisionNeeded: false,
    preVerifyDecision: null,
    codeAttempts: 2,
    codeFirstAttemptSuccess: false,
    postVerifyDecision: 'FLAG',
    postVerifyIssues: ['edge_case_handling'],
    retryCount: 1,
    debugSuccess: true,
    finalOutcome: 'COMMITTED',
    totalDurationMs: 75000,
    committedAt: '2026-05-05T11:00:00Z',
    phases: [
      { phaseId: 'SYNTH-002-ROUTER', agentType: 'ROUTER', phaseOrder: 1, decision: 'LEVEL_1', durationMs: 500, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'CODE' },
      { phaseId: 'SYNTH-002-CODE-1', agentType: 'CODE', phaseOrder: 2, durationMs: 25000, modelUsed: 'deepseek/deepseek-v4-flash', decision: 'FAIL', decisionReason: 'Race condition not fully resolved', transitionedTo: 'DEBUG' },
      { phaseId: 'SYNTH-002-DEBUG', agentType: 'CODE', phaseOrder: 3, durationMs: 30000, modelUsed: 'deepseek/deepseek-v4-flash', decision: 'FIXED', decisionReason: 'Added mutex lock', transitionedTo: 'POST_VERIFY' },
      { phaseId: 'SYNTH-002-CODE-2', agentType: 'CODE', phaseOrder: 4, durationMs: 10000, modelUsed: 'deepseek/deepseek-v4-flash', decision: 'PASS', transitionedTo: 'POST_VERIFY' },
      { phaseId: 'SYNTH-002-POSTVERIFY', agentType: 'POST_VERIFY', phaseOrder: 5, decision: 'FLAG', decisionReason: 'Minor edge case concerns', durationMs: 5000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'COMMIT' },
    ],
  },

  // ─── Synthetic: SYNTH-003 (LEVEL_2, pagination, plan+code, success) ───────
  {
    executionId: 'SYNTH-003',
    requestSummary: 'Add cursor-based pagination to the recommendations list endpoint',
    routerRoute: 'LEVEL_2',
    routerConfidence: 0.85,
    routerRisk: 'low',
    routerReason: 'Feature addition with schema consideration. Needs planning for API design.',
    planSummary: 'Pagination plan with 2 tasks: cursor implementation, API doc update',
    planTaskCount: 2,
    archReviewed: false,
    archRevisionNeeded: false,
    preVerifyDecision: 'PASS',
    codeAttempts: 1,
    codeFirstAttemptSuccess: true,
    postVerifyDecision: 'PASS',
    retryCount: 0,
    debugSuccess: null,
    finalOutcome: 'COMMITTED',
    totalDurationMs: 60000,
    committedAt: '2026-05-10T13:00:00Z',
    phases: [
      { phaseId: 'SYNTH-003-ROUTER', agentType: 'ROUTER', phaseOrder: 1, decision: 'LEVEL_2', durationMs: 600, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PLAN' },
      { phaseId: 'SYNTH-003-PLAN', agentType: 'PLAN', phaseOrder: 2, decision: 'PASS', durationMs: 12000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PRE_VERIFY' },
      { phaseId: 'SYNTH-003-PREVERIFY', agentType: 'PRE_VERIFY', phaseOrder: 3, decision: 'PASS', durationMs: 3000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'CODE' },
      { phaseId: 'SYNTH-003-CODE', agentType: 'CODE', phaseOrder: 4, durationMs: 35000, modelUsed: 'deepseek/deepseek-v4-flash', decision: 'PASS', transitionedTo: 'POST_VERIFY' },
      { phaseId: 'SYNTH-003-POSTVERIFY', agentType: 'POST_VERIFY', phaseOrder: 5, decision: 'PASS', durationMs: 5000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'COMMIT' },
    ],
  },

  // ─── Synthetic: SYNTH-004 (LEVEL_2, Redis caching, BLOCKED by ARCH) ───────
  {
    executionId: 'SYNTH-004',
    requestSummary: 'Implement Redis caching layer for recommendation queries',
    routerRoute: 'LEVEL_2',
    routerConfidence: 0.80,
    routerRisk: 'medium',
    routerReason: 'Caching layer with performance implications. Needs plan and architecture review.',
    planSummary: 'Caching plan with 3 tasks: Redis config, cache middleware, invalidation strategy',
    planTaskCount: 3,
    archReviewed: true,
    archRevisionNeeded: false,
    preVerifyDecision: 'BLOCK',
    preVerifyFlags: ['infrastructure_concern', 'cost_implications'],
    codeAttempts: 0,
    codeFirstAttemptSuccess: null,
    postVerifyDecision: null,
    retryCount: 0,
    debugSuccess: null,
    finalOutcome: 'BLOCKED',
    totalDurationMs: 80000,
    committedAt: null,
    phases: [
      { phaseId: 'SYNTH-004-ROUTER', agentType: 'ROUTER', phaseOrder: 1, decision: 'LEVEL_2', durationMs: 500, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PLAN' },
      { phaseId: 'SYNTH-004-PLAN', agentType: 'PLAN', phaseOrder: 2, decision: 'PASS', durationMs: 15000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'ARCH' },
      { phaseId: 'SYNTH-004-ARCH', agentType: 'ARCHITECT', phaseOrder: 3, decision: 'BLOCK', decisionReason: 'Redis infra not ready, cost concerns', durationMs: 20000, modelUsed: 'deepseek/deepseek-v4-flash' },
      { phaseId: 'SYNTH-004-PREVERIFY', agentType: 'PRE_VERIFY', phaseOrder: 4, decision: 'BLOCK', decisionReason: 'Blocked by architecture decision', durationMs: 3000, modelUsed: 'deepseek/deepseek-v4-flash' },
    ],
  },

  // ─── Synthetic: SYNTH-005 (LEVEL_3, RBAC upgrade, revision, success) ──────
  {
    executionId: 'SYNTH-005',
    requestSummary: 'Implement RBAC authorization system with role-based access control',
    routerRoute: 'LEVEL_3',
    routerConfidence: 0.75,
    routerRisk: 'high',
    routerReason: 'Complex auth system with security implications. Requires thorough planning and architecture.',
    planSummary: 'RBAC plan with 4 tasks: role model, permission system, guard implementation, migration',
    planTaskCount: 4,
    archReviewed: true,
    archRevisionNeeded: true,
    preVerifyDecision: 'PASS',
    codeAttempts: 1,
    codeFirstAttemptSuccess: true,
    postVerifyDecision: 'PASS',
    retryCount: 0,
    debugSuccess: null,
    finalOutcome: 'COMMITTED',
    totalDurationMs: 250000,
    committedAt: '2026-05-20T18:00:00Z',
    phases: [
      { phaseId: 'SYNTH-005-ROUTER', agentType: 'ROUTER', phaseOrder: 1, decision: 'LEVEL_3', durationMs: 1000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PLAN' },
      { phaseId: 'SYNTH-005-PLAN', agentType: 'PLAN', phaseOrder: 2, decision: 'PASS', durationMs: 30000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'ARCH' },
      { phaseId: 'SYNTH-005-ARCH', agentType: 'ARCHITECT', phaseOrder: 3, decision: 'REVISION_NEEDED', decisionReason: 'Role hierarchy needs redesign', durationMs: 40000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PLAN' },
      { phaseId: 'SYNTH-005-PLAN-REV', agentType: 'PLAN', phaseOrder: 4, decision: 'PASS', decisionReason: 'Revised RBAC plan approved', durationMs: 15000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'ARCH' },
      { phaseId: 'SYNTH-005-ARCH-2', agentType: 'ARCHITECT', phaseOrder: 5, decision: 'PASS', decisionReason: 'Architecture approved', durationMs: 10000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PRE_VERIFY' },
      { phaseId: 'SYNTH-005-PREVERIFY', agentType: 'PRE_VERIFY', phaseOrder: 6, decision: 'PASS', durationMs: 8000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'CODE' },
      { phaseId: 'SYNTH-005-CODE', agentType: 'CODE', phaseOrder: 7, durationMs: 120000, modelUsed: 'deepseek/deepseek-v4-flash', decision: 'PASS', transitionedTo: 'POST_VERIFY' },
      { phaseId: 'SYNTH-005-POSTVERIFY', agentType: 'POST_VERIFY', phaseOrder: 8, decision: 'PASS', durationMs: 15000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'COMMIT' },
    ],
  },

  // ─── Synthetic: SYNTH-006 (LEVEL_3, DB migration, BLOCKED) ────────────────
  {
    executionId: 'SYNTH-006',
    requestSummary: 'Propose and implement database migration from PostgreSQL to CockroachDB',
    routerRoute: 'LEVEL_3',
    routerConfidence: 0.70,
    routerRisk: 'high',
    routerReason: 'Major infrastructure change with significant risk. Architecture review mandatory.',
    planSummary: null,
    planTaskCount: 0,
    archReviewed: true,
    archRevisionNeeded: false,
    preVerifyDecision: 'BLOCK',
    preVerifyFlags: ['infrastructure_change', 'vendor_lock_in'],
    codeAttempts: 0,
    codeFirstAttemptSuccess: null,
    postVerifyDecision: null,
    retryCount: 0,
    debugSuccess: null,
    finalOutcome: 'BLOCKED',
    totalDurationMs: 95000,
    committedAt: null,
    phases: [
      { phaseId: 'SYNTH-006-ROUTER', agentType: 'ROUTER', phaseOrder: 1, decision: 'LEVEL_3', durationMs: 800, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'PLAN' },
      { phaseId: 'SYNTH-006-PLAN', agentType: 'PLAN', phaseOrder: 2, decision: 'FLAG', decisionReason: 'High-risk plan flagged', durationMs: 20000, modelUsed: 'deepseek/deepseek-v4-flash', transitionedTo: 'ARCH' },
      { phaseId: 'SYNTH-006-ARCH', agentType: 'ARCHITECT', phaseOrder: 3, decision: 'BLOCK', decisionReason: 'Migration not justified, vendor lock-in risk', durationMs: 35000, modelUsed: 'deepseek/deepseek-v4-flash' },
      { phaseId: 'SYNTH-006-PREVERIFY', agentType: 'PRE_VERIFY', phaseOrder: 4, decision: 'BLOCK', decisionReason: 'Blocked by architecture decision', durationMs: 4000, modelUsed: 'deepseek/deepseek-v4-flash' },
    ],
  },
];

async function main() {
  console.log('Seeding evaluation harness data...\n');

  let executionCount = 0;
  let phaseCount = 0;

  for (const exec of seedData) {
    // Check if execution already exists
    const existing = await prisma.agentExecution.findUnique({
      where: { executionId: exec.executionId },
    });

    if (existing) {
      console.log(`  ⏭️  ${exec.executionId} already exists, skipping`);
      continue;
    }

    // Create execution with phases
    // Use ?? undefined to convert explicit null to undefined for Prisma nullable fields
    await prisma.agentExecution.create({
      data: {
        executionId: exec.executionId,
        requestSummary: exec.requestSummary,
        routerRoute: exec.routerRoute,
        routerConfidence: exec.routerConfidence,
        routerRisk: exec.routerRisk,
        routerReason: exec.routerReason,
        planSummary: exec.planSummary ?? undefined,
        planTaskCount: exec.planTaskCount ?? undefined,
        archReviewed: exec.archReviewed,
        archRevisionNeeded: exec.archRevisionNeeded,
        preVerifyDecision: exec.preVerifyDecision ?? undefined,
        preVerifyFlags: exec.preVerifyFlags as any,
        codeAttempts: exec.codeAttempts,
        codeFirstAttemptSuccess: exec.codeFirstAttemptSuccess ?? undefined,
        postVerifyDecision: exec.postVerifyDecision ?? undefined,
        postVerifyIssues: exec.postVerifyIssues as any,
        retryCount: exec.retryCount,
        debugSuccess: exec.debugSuccess ?? undefined,
        finalOutcome: exec.finalOutcome,
        totalDurationMs: exec.totalDurationMs ?? undefined,
        committedAt: exec.committedAt ? new Date(exec.committedAt) : undefined,
        phases: {
          create: exec.phases.map((p) => {
            const phaseData: Record<string, any> = {
              phaseId: p.phaseId,
              agentType: p.agentType,
              phaseOrder: p.phaseOrder,
            };
            if (p.input) phaseData.input = p.input as any;
            if (p.output) phaseData.output = p.output as any;
            if (p.decision !== undefined) phaseData.decision = p.decision;
            if (p.decisionReason !== undefined) phaseData.decisionReason = p.decisionReason;
            if (p.durationMs !== undefined) phaseData.durationMs = p.durationMs;
            if (p.modelUsed !== undefined) phaseData.modelUsed = p.modelUsed;
            if (p.transitionedTo !== undefined) phaseData.transitionedTo = p.transitionedTo;
            return phaseData as any;
          }),
        },
      },
    });

    executionCount++;
    phaseCount += exec.phases.length;
    console.log(`  ✅ ${exec.executionId} created (${exec.phases.length} phases)`);
  }

  console.log(`\nDone. Created ${executionCount} executions with ${phaseCount} total phases.`);

  // ─── AgentMemory Seed Data (TASK-029) ──────────────────────────────────
  console.log('\nSeeding AgentMemory sample data...\n');

  const agentMemorySeeds = [
    {
      memoryId: 'MEM-SEED-ROUTER-001',
      agentType: 'ROUTER' as const,
      taskType: 'LEVEL_1',
      outcome: 'SUCCESS' as const,
      success: true,
      context: { requestSummary: 'Add simple CRUD endpoints for tags entity', routerRoute: 'LEVEL_1', routerConfidence: 0.97 },
      decision: 'LEVEL_1',
      lessonsLearned: ["Routed 'Add simple CRUD endpoints for tags entity' to LEVEL_1"],
      sourceExecutionId: 'SYNTH-001',
      sourcePhaseId: 'SYNTH-001-ROUTER',
    },
    {
      memoryId: 'MEM-SEED-PLAN-001',
      agentType: 'PLAN' as const,
      taskType: 'LEVEL_2',
      outcome: 'SUCCESS' as const,
      success: true,
      context: { requestSummary: 'Add cursor-based pagination to recommendations', routerRoute: 'LEVEL_2', routerConfidence: 0.85 },
      decision: 'PASS',
      lessonsLearned: ['PLAN phase completed with outcome PASS'],
      sourceExecutionId: 'SYNTH-003',
      sourcePhaseId: 'SYNTH-003-PLAN',
    },
    {
      memoryId: 'MEM-SEED-CODE-001',
      agentType: 'CODE' as const,
      taskType: 'LEVEL_1',
      outcome: 'MIXED' as const,
      success: true,
      context: { requestSummary: 'Fix race condition in WebSocket handler', routerRoute: 'LEVEL_1', routerConfidence: 0.90 },
      decision: 'PASS',
      lessonsLearned: ['Code required 2 attempts'],
      sourceExecutionId: 'SYNTH-002',
      sourcePhaseId: 'SYNTH-002-CODE-2',
    },
    {
      memoryId: 'MEM-SEED-PREVERIFY-001',
      agentType: 'PRE_VERIFY' as const,
      taskType: 'LEVEL_2',
      outcome: 'BLOCKED' as const,
      success: false,
      context: { requestSummary: 'Implement Redis caching layer for recommendation queries', routerRoute: 'LEVEL_2', routerConfidence: 0.80 },
      decision: 'BLOCK',
      lessonsLearned: ['Pre-verify blocked: infrastructure_concern, cost_implications'],
      sourceExecutionId: 'SYNTH-004',
      sourcePhaseId: 'SYNTH-004-PREVERIFY',
    },
    {
      memoryId: 'MEM-SEED-POSTVERIFY-001',
      agentType: 'POST_VERIFY' as const,
      taskType: 'LEVEL_3',
      outcome: 'SUCCESS' as const,
      success: true,
      context: { requestSummary: 'Implement RBAC authorization system', routerRoute: 'LEVEL_3', routerConfidence: 0.75 },
      decision: 'PASS',
      lessonsLearned: ['POST_VERIFY phase completed with outcome PASS'],
      sourceExecutionId: 'SYNTH-005',
      sourcePhaseId: 'SYNTH-005-POSTVERIFY',
    },
  ];

  let agentMemoryCount = 0;

  for (const seed of agentMemorySeeds) {
    const existing = await prisma.agentMemory.findUnique({
      where: { memoryId: seed.memoryId },
    });

    if (existing) {
      console.log(`  ⏭️  ${seed.memoryId} already exists, skipping`);
      continue;
    }

    await prisma.agentMemory.create({
      data: {
        memoryId: seed.memoryId,
        agentType: seed.agentType,
        taskType: seed.taskType,
        context: seed.context as any,
        decision: seed.decision,
        outcome: seed.outcome,
        success: seed.success,
        lessonsLearned: seed.lessonsLearned,
        sourceExecutionId: seed.sourceExecutionId,
        sourcePhaseId: seed.sourcePhaseId,
        domain: null,
        technology: null,
        projectId: '__global__',
        referenceCount: 1,
        decayWeight: 1.0,
      },
    });

    agentMemoryCount++;
    console.log(`  ✅ ${seed.memoryId} created`);
  }

  const totalMemories = await prisma.agentMemory.count();
  console.log(`\nAgentMemory seeds: ${agentMemoryCount} new, ${totalMemories} total in DB`);

  // Summary
  const totalExecs = await prisma.agentExecution.count();
  const totalPhases = await prisma.executionPhase.count();
  console.log(`Total in DB: ${totalExecs} executions, ${totalPhases} phases, ${totalMemories} agent memories`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
