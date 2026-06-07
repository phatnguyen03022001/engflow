// @lifecycle ACTIVE — Unit tests for ExecutiveReviewService
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutiveReviewService } from '../services/executive-review.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('ExecutiveReviewService', () => {
  let service: ExecutiveReviewService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    recommendation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const makeRec = (overrides: Record<string, unknown> = {}) => ({
    recId: 'REC-001',
    decisionDomain: 'queue-system',
    decisionType: 'TC',
    recommendedOption: 'BullMQ',
    finalOutcome: 'SUCCESS',
    querySummary: 'Should we use BullMQ?',
    regretFlag: false,
    createdAt: new Date('2026-01-15'),
    checkpoints: [
      { solutionScore: 4 },
      { solutionScore: 5 },
      { solutionScore: 4 },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutiveReviewService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ExecutiveReviewService>(ExecutiveReviewService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateReport', () => {
    it('should generate a report with assessed recommendations', async () => {
      const successRec = makeRec();
      const failureRec = makeRec({
        recId: 'REC-002',
        finalOutcome: 'FAILURE',
        regretFlag: true,
        decisionDomain: 'auth',
        decisionType: 'AP',
        recommendedOption: 'JWT',
        checkpoints: [{ solutionScore: 2 }],
      });

      mockPrisma.recommendation.findMany.mockResolvedValue([
        successRec,
        failureRec,
      ]);
      mockPrisma.recommendation.count.mockResolvedValue(5);

      const report = await service.generateReport();

      expect(report).toBeDefined();
      expect(report.executiveSummary.totalRecommendations).toBe(5);
      expect(report.executiveSummary.assessed).toBe('2 (40%)');
      expect(report.executiveSummary.overallAccuracy).toBe('50%');
      expect(report.topBestDecisions).toHaveLength(1);
      expect(report.topBestDecisions[0].recId).toBe('REC-001');
      expect(report.topWorstDecisions).toHaveLength(1);
      expect(report.topWorstDecisions[0].recId).toBe('REC-002');
    });

    it('should generate report with no data', async () => {
      mockPrisma.recommendation.findMany.mockResolvedValue([]);
      mockPrisma.recommendation.count.mockResolvedValue(0);

      const report = await service.generateReport();

      expect(report.executiveSummary.totalRecommendations).toBe(0);
      expect(report.executiveSummary.assessed).toBe('0 (0%)');
      expect(report.executiveSummary.overallAccuracy).toBe('N/A');
      expect(report.topBestDecisions).toHaveLength(0);
      expect(report.topWorstDecisions).toHaveLength(0);
    });

    it('should generate lessons when ≥3 failures exist', async () => {
      const failures = Array.from({ length: 3 }, (_, i) =>
        makeRec({
          recId: `REC-FAIL-${i}`,
          finalOutcome: 'FAILURE',
        }),
      );
      const successes = Array.from({ length: 5 }, (_, i) =>
        makeRec({ recId: `REC-SUCCESS-${i}` }),
      );

      mockPrisma.recommendation.findMany.mockResolvedValue([
        ...successes,
        ...failures,
      ]);
      mockPrisma.recommendation.count.mockResolvedValue(10);

      const report = await service.generateReport();

      expect(report.lessonsLearned).toHaveLength(1);
      expect(report.lessonsLearned[0].lesson).toContain('Failure patterns detected');
    });

    it('should generate "no pattern" lessons when <3 failures exist', async () => {
      const failures = Array.from({ length: 2 }, (_, i) =>
        makeRec({
          recId: `REC-FAIL-${i}`,
          finalOutcome: 'FAILURE',
        }),
      );

      mockPrisma.recommendation.findMany.mockResolvedValue(failures);
      mockPrisma.recommendation.count.mockResolvedValue(5);

      const report = await service.generateReport();

      expect(report.lessonsLearned).toHaveLength(1);
      expect(report.lessonsLearned[0].lesson).toContain('No significant failure patterns');
    });

    it('should calculate overallAccuracy correctly with MIXED outcomes', async () => {
      const recs = [
        makeRec({ recId: 'REC-001', finalOutcome: 'SUCCESS' }),
        makeRec({ recId: 'REC-002', finalOutcome: 'SUCCESS' }),
        makeRec({ recId: 'REC-003', finalOutcome: 'FAILURE' }),
        makeRec({ recId: 'REC-004', finalOutcome: 'MIXED' }),
      ];

      mockPrisma.recommendation.findMany.mockResolvedValue(recs);
      mockPrisma.recommendation.count.mockResolvedValue(10);

      const report = await service.generateReport();

      // 2 SUCCESS out of 4 = 50%
      expect(report.executiveSummary.overallAccuracy).toBe('50%');
    });

    it('should include failure pattern analysis by type and domain', async () => {
      const failures = [
        makeRec({ recId: 'REC-001', finalOutcome: 'FAILURE', decisionType: 'TC', decisionDomain: 'database' }),
        makeRec({ recId: 'REC-002', finalOutcome: 'FAILURE', decisionType: 'TC', decisionDomain: 'database' }),
        makeRec({ recId: 'REC-003', finalOutcome: 'MIXED', decisionType: 'AP', decisionDomain: 'auth' }),
        makeRec({ recId: 'REC-004', finalOutcome: 'FAILURE', decisionType: 'BB', decisionDomain: 'infra' }),
        makeRec({ recId: 'REC-005', finalOutcome: 'FAILURE', decisionType: 'BB', decisionDomain: 'infra' }),
      ];

      mockPrisma.recommendation.findMany.mockResolvedValue(failures);
      mockPrisma.recommendation.count.mockResolvedValue(10);

      const report = await service.generateReport();

      expect(report.failurePatternAnalysis.byDecisionType.TC).toBe(2);
      expect(report.failurePatternAnalysis.byDomain.database).toBe(2);
      // 5 failures → triggers identifyFailureModes
      expect(report.failurePatternAnalysis.topFailureModes.length).toBeGreaterThan(0);
    });
  });
});
