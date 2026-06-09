// @lifecycle ACTIVE — Integration test: Recommendation life cycle (create → assess → trust recalc)
import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationService } from '../src/recommendation/services/recommendation.service';
import { TrustScoreService } from '../src/recommendation/services/trust-score.service';
import { CheckpointService } from '../src/recommendation/services/checkpoint.service';
import { DecisionMemoryService } from '../src/recommendation/services/decision-memory.service';
import { MemoryService } from '../src/memory/services/memory.service';
import { ExecutiveReviewService } from '../src/recommendation/services/executive-review.service';
import { AccuracyService } from '../src/recommendation/services/accuracy.service';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { CreateRecommendationDto } from '../src/recommendation/dto/create-recommendation.dto';
import { UpdateCheckpointDto } from '../src/recommendation/dto/update-checkpoint.dto';

describe('Recommendation Lifecycle (e2e)', () => {
  let recommendationService: RecommendationService;
  let trustScoreService: TrustScoreService;
  let checkpointService: CheckpointService;
  let decisionMemoryService: DecisionMemoryService;
  let executiveReviewService: ExecutiveReviewService;

  // Shared mock state for simulating database persistence across calls
  const db: {
    recommendations: Map<string, Record<string, unknown>>;
    trustScores: Array<Record<string, unknown>>;
    checkpoints: Array<Record<string, unknown>>;
    decisionMemories: Array<Record<string, unknown>>;
    accuracySnapshots: Array<Record<string, unknown>>;
  } = {
    recommendations: new Map(),
    trustScores: [],
    checkpoints: [],
    decisionMemories: [],
    accuracySnapshots: [],
  };

  const mockPrisma: Record<string, Record<string, jest.Mock> | jest.Mock> = {
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(mockPrisma)),
    recommendation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    checkpoint: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    trustScore: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    decisionMemory: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    accuracySnapshot: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        TrustScoreService,
        CheckpointService,
        DecisionMemoryService,
        ExecutiveReviewService,
        AccuracyService,
        {
          provide: MemoryService,
          useValue: {
            createMemory: jest.fn().mockResolvedValue({}),
            querySimilar: jest.fn().mockResolvedValue([]),
            getTopPatterns: jest.fn().mockResolvedValue([]),
            getSummary: jest.fn().mockResolvedValue({ totalMemories: 0, byAgentType: {}, activeMemories: 0, staleMemories: 0, perDomainBreakdown: [] }),
            createFromExecution: jest.fn().mockResolvedValue([]),
            decayAll: jest.fn(),
            cleanupStale: jest.fn().mockResolvedValue(0),
          },
        },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    recommendationService = module.get(RecommendationService);
    trustScoreService = module.get(TrustScoreService);
    checkpointService = module.get(CheckpointService);
    decisionMemoryService = module.get(DecisionMemoryService);
    executiveReviewService = module.get(ExecutiveReviewService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    // Re-establish $transaction pass-through (resetAllMocks clears implementations)
    mockPrisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(mockPrisma));
    db.recommendations.clear();
    db.trustScores = [];
    db.checkpoints = [];
    db.decisionMemories = [];
    db.accuracySnapshots = [];
  });

  it('should complete full lifecycle: CREATE → IN_PROGRESS → ASSESSED → TRUST RECALC', async () => {
    // ─── Step 1: CREATE recommendation ─────────────────────────────────────
    const createDto: CreateRecommendationDto = {
      recId: 'REC-E2E-001',
      mode: 'ADVISOR',
      decisionType: 'TC',
      decisionDomain: 'queue-system',
      querySummary: 'Should we use BullMQ?',
      recommendedOption: 'BullMQ',
      weightedScore: 4.5,
      scoreMargin: 1.2,
      justification: 'Mature, Redis-based, active community',
      confidenceLevel: 'HIGH',
      confidenceScore: 82,
      options: [
        { label: 'A', description: 'BullMQ', score: 4.5 },
        { label: 'B', description: 'RabbitMQ', score: 3.3 },
      ],
      sourcesConsulted: [],
      constraints: [],
      successCriteria: [],
      riskMitigations: [],
    };

    const createdRec = {
      id: 'rec-uuid-e2e-1',
      recId: 'REC-E2E-001',
      mode: 'ADVISOR',
      decisionType: 'TC',
      decisionDomain: 'queue-system',
      querySummary: 'Should we use BullMQ?',
      recommendedOption: 'BullMQ',
      weightedScore: 4.5,
      scoreMargin: 1.2,
      justification: 'Mature, Redis-based, active community',
      confidenceLevel: 'HIGH',
      confidenceScore: 82,
      trackingStatus: 'PENDING',
      finalOutcome: null,
      assessedAt: null,
      regretFlag: null,
      reversalCount: 0,
      options: [
        { label: 'A', description: 'BullMQ', score: 4.5 },
        { label: 'B', description: 'RabbitMQ', score: 3.3 },
      ],
      checkpoints: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.recommendation.findUnique.mockResolvedValue(null);
    mockPrisma.recommendation.create.mockResolvedValue(createdRec);
    db.recommendations.set('rec-uuid-e2e-1', createdRec);

    const result = await recommendationService.create(createDto);
    expect(result.recId).toBe('REC-E2E-001');
    expect(result.trackingStatus).toBe('PENDING');

    // ─── Step 2: UPDATE to IN_PROGRESS (triggers checkpoint creation) ─────
    mockPrisma.recommendation.findUnique.mockResolvedValue({
      ...createdRec,
      trackingStatus: 'PENDING',
    });
    const inProgressRec = {
      ...createdRec,
      trackingStatus: 'IN_PROGRESS',
      checkpoints: [
        { checkpoint: '30D', scheduleAt: new Date() },
        { checkpoint: '90D', scheduleAt: new Date() },
        { checkpoint: '180D', scheduleAt: new Date() },
      ],
    };
    mockPrisma.recommendation.update.mockResolvedValue(inProgressRec);
    mockPrisma.checkpoint.upsert.mockResolvedValue({ evaluatedAt: null });

    const updated = await recommendationService.updateStatus('rec-uuid-e2e-1', 'IN_PROGRESS');
    expect(updated.trackingStatus).toBe('IN_PROGRESS');
    // Should have created 3 checkpoints
    expect(mockPrisma.checkpoint.upsert).toHaveBeenCalledTimes(3);

    // ─── Step 3: ASSESS all 3 checkpoints → triggers ASSESSED transition ───
    const checkpointDto: UpdateCheckpointDto = {
      checkpoint: '30D',
      evaluator: 'human',
      wasImplemented: true,
      implementedOption: 'BullMQ',
      problemSolved: true,
      solutionScore: 4,
      checkpointVerdict: 'ON_TRACK',
      verdictConfidence: 'HIGH',
    };

    // After upserting, checkAndTransition runs: mock 3 checkpoints all evaluated
    const assessedCheckpoints = [
      { evaluatedAt: new Date(), checkpointVerdict: 'ON_TRACK' },
      { evaluatedAt: new Date(), checkpointVerdict: 'ON_TRACK' },
      { evaluatedAt: new Date(), checkpointVerdict: 'ON_TRACK' },
    ];

    const assessedRec = {
      ...inProgressRec,
      trackingStatus: 'ASSESSED',
      finalOutcome: 'SUCCESS',
      assessedAt: new Date(),
    };

    // First call: send 30D checkpoint
    mockPrisma.recommendation.findUnique
      .mockResolvedValueOnce(inProgressRec)    // upsertCheckpoint: validate recommendation exists
      .mockResolvedValueOnce(inProgressRec);   // autoAssess: validate rec exists (not used in this flow)
    mockPrisma.checkpoint.upsert.mockResolvedValue({
      id: 'cp-30d',
      recommendationId: 'rec-uuid-e2e-1',
      checkpoint: '30D',
      evaluatedAt: new Date(),
      checkpointVerdict: 'ON_TRACK',
    });
    // After upsert, checkAndTransition queries ALL checkpoints: return all 3 assessed
    mockPrisma.checkpoint.findMany.mockResolvedValue(assessedCheckpoints);
    mockPrisma.recommendation.update.mockResolvedValue(assessedRec);

    const cpResult = await checkpointService.upsertCheckpoint('rec-uuid-e2e-1', checkpointDto);
    expect(cpResult).toBeDefined();

    // ─── Step 4: RECALCULATE trust scores ──────────────────────────────────
    // Sequential order: recalculateGlobal → recalculateByDecisionType (6) → recalculateByDomain
    // Global: 1 SUCCESS
    mockPrisma.recommendation.findMany
      .mockResolvedValueOnce([{ finalOutcome: 'SUCCESS' }])  // #1 Global
      .mockResolvedValueOnce([{ finalOutcome: 'SUCCESS' }])  // #2 DT: TC
      .mockResolvedValue([]);                                 // #3-7 DT: AP, IA, TS, PC, BB

    // Domain: needs decisionDomain field
    mockPrisma.recommendation.findMany
      .mockResolvedValueOnce([{ decisionDomain: 'queue-system', finalOutcome: 'SUCCESS' }]);

    mockPrisma.trustScore.findFirst
      .mockResolvedValue(null);  // No existing records → create path

    mockPrisma.trustScore.create.mockResolvedValue({});

    await trustScoreService.recalculateAll();

    // Trust score for GLOBAL with 1 SUCCESS out of 1: (1 + 6) / (1 + 6 + 4) = 7/11 ≈ 64
    const globalCreateCall = (
      mockPrisma.trustScore.create.mock.calls as Array<[{ data: { level: string; score: number } }]>
    ).find((call) => call[0].data.level === 'GLOBAL');
    expect(globalCreateCall).toBeDefined();
    expect(globalCreateCall![0].data.score).toBe(64);
  });

  it('should handle a recommendation that gets FAILURE outcome', async () => {
    // ─── CREATE ────────────────────────────────────────────────────────────
    const createDto: CreateRecommendationDto = {
      recId: 'REC-E2E-002',
      mode: 'ADVISOR',
      decisionType: 'BB',
      decisionDomain: 'infra',
      querySummary: 'Build vs Buy queue?',
      recommendedOption: 'Build custom',
      weightedScore: 3.0,
      scoreMargin: 0.5,
      justification: 'Custom solution needed',
      confidenceLevel: 'LOW',
      confidenceScore: 40,
      options: [
        { label: 'A', description: 'Build custom', score: 3.0 },
        { label: 'B', description: 'BullMQ', score: 4.0 },
      ],
      sourcesConsulted: [],
      constraints: [],
      successCriteria: [],
      riskMitigations: [],
    };

    const createdRec = {
      id: 'rec-uuid-e2e-2',
      recId: 'REC-E2E-002',
      mode: 'ADVISOR',
      decisionType: 'BB',
      decisionDomain: 'infra',
      recommendedOption: 'Build custom',
      weightedScore: 3.0,
      trackingStatus: 'PENDING',
      finalOutcome: null,
      options: [],
      checkpoints: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.recommendation.findUnique.mockResolvedValue(null);
    mockPrisma.recommendation.create.mockResolvedValue(createdRec);

    const result = await recommendationService.create(createDto);
    expect(result.trackingStatus).toBe('PENDING');

    // ─── SET FAILURE OUTCOME ────────────────────────────────────────────────
    const failureRec = {
      ...createdRec,
      trackingStatus: 'ASSESSED',
      finalOutcome: 'FAILURE',
      assessedAt: new Date(),
    };
    mockPrisma.recommendation.update.mockResolvedValue(failureRec);

    const assessed = await recommendationService.setFinalOutcome('rec-uuid-e2e-2', 'FAILURE');
    expect(assessed.finalOutcome).toBe('FAILURE');
    expect(assessed.trackingStatus).toBe('ASSESSED');

    // ─── CREATE DECISION MEMORY ────────────────────────────────────────────
    mockPrisma.recommendation.findUnique.mockResolvedValue(failureRec);
    mockPrisma.decisionMemory.upsert.mockResolvedValue({
      memoryId: 'MEM-E2E-001',
      domain: 'infra',
      technology: 'Build custom',
      outcome: 'FAILURE',
    });

    const memory = await decisionMemoryService.createFromAssessment('rec-uuid-e2e-2');
    expect(memory).toBeDefined();
    expect(memory!.outcome).toBe('FAILURE');

    // ─── GENERATE EXECUTIVE REVIEW ─────────────────────────────────────────
    mockPrisma.recommendation.findMany.mockResolvedValue([failureRec]);
    mockPrisma.recommendation.count.mockResolvedValue(5);

    const report = await executiveReviewService.generateReport();
    expect(report.executiveSummary.totalRecommendations).toBe(5);
    expect(report.topWorstDecisions).toHaveLength(1);
    expect(report.topWorstDecisions[0].outcome).toBe('FAILURE');
  });

  it('should handle empty state gracefully', async () => {
    // All queries return empty arrays
    mockPrisma.recommendation.findMany.mockResolvedValue([]);
    mockPrisma.recommendation.count.mockResolvedValue(0);
    mockPrisma.recommendation.groupBy.mockResolvedValue([]);
    mockPrisma.trustScore.findFirst.mockResolvedValue(null);
    mockPrisma.trustScore.create.mockResolvedValue({});

    // Status summary
    const status = await recommendationService.countByStatus();
    expect(status.PENDING).toBe(0);
    expect(status.IN_PROGRESS).toBe(0);
    expect(status.ASSESSED).toBe(0);

    // Trust scores with no data should return prior trust
    const globalScore = await trustScoreService.recalculateGlobal();
    expect(globalScore.score).toBe(60); // GLOBAL prior = 0.6 * 100
    expect(globalScore.sampleSize).toBe(0);

    // Executive review with no data
    const report = await executiveReviewService.generateReport();
    expect(report.executiveSummary.overallAccuracy).toBe('N/A');
    expect(report.topBestDecisions).toHaveLength(0);
    expect(report.topWorstDecisions).toHaveLength(0);
  });
});
