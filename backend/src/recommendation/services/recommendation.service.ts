// @lifecycle ACTIVE — Core recommendation registry service

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateRecommendationDto } from '../dto/create-recommendation.dto';
import { RecommendationAnalytics } from '../interfaces/recommendation-analytics.interface';

// Server-controlled analytics keys that MUST NOT originate from user DTO input.
// These are provided exclusively via the `analytics` parameter from trusted
// internal callers (e.g., Ask-ingest). The runtime guard below catches any
// refactoring error or protocol bypass that would let these reach Prisma.
const FORBIDDEN_ANALYTICS_KEYS: ReadonlyArray<keyof RecommendationAnalytics> = [
  'confidenceScore',
  'weightedScore',
  'scoreMargin',
  'ecs',
  'sqs',
  'cs',
];

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a recommendation.
   *
   * Analytics/scoring fields are NEVER accepted from DTO input.
   * Trusted internal callers provide them via the optional `analytics`
   * parameter. Untrusted callers (REST API) get safe defaults.
   *
   * @param dto - User-facing fields
   * @param analytics - Optional server-controlled analytics (trusted callers only)
   */
  async create(dto: CreateRecommendationDto, analytics?: RecommendationAnalytics) {
    const existing = await this.prisma.recommendation.findUnique({
      where: { recId: dto.recId },
    });
    if (existing) {
      throw new ConflictException(
        `Recommendation ${dto.recId} already exists`,
      );
    }

    // ── Runtime guard ──────────────────────────────────────────────────────
    // Detect any attempt to inject analytics fields through the DTO.
    // This protects against:
    //   - Protocol bypass (untrusted callers reaching the service)
    //   - ValidationPipe misconfiguration (whitelist disabled)
    //   - Refactoring errors that introduce analytics fields to the DTO
    for (const key of FORBIDDEN_ANALYTICS_KEYS) {
      if (key in dto) {
        this.logger.warn(
          `Blocked ${String(key)} injection attempt through DTO — discarded`,
        );
        // Delete to prevent any residual path to Prisma
        delete (dto as unknown as Record<string, unknown>)[key];
      }
    }

    // ── Extract nested/relation fields ─────────────────────────────────────
    // Note: there is NO rest spread (...data) here. Every user-controlled
    // field is explicitly mapped below, ensuring analytics fields from the
    // DTO can never reach the Prisma payload regardless of spread ordering.
    const { options, escalationHistory, predictedRisks } = dto;

    // ── Build Prisma create payload with explicit field mapping ────────────
    // Section 1: User-controlled fields (from DTO)
    // Section 2: Server-controlled analytics fields (from analytics param)
    // Section 3: Relation/nested fields
    const recommendation = await this.prisma.recommendation.create({
      data: {
        // 1. User-controlled fields (explicit mapping — no spread)
        recId: dto.recId,
        mode: dto.mode,
        decisionType: dto.decisionType,
        decisionDomain: dto.decisionDomain,
        querySummary: dto.querySummary,
        projectId: dto.projectId ?? null,
        constraints: dto.constraints ?? [],
        sourcesConsulted: dto.sourcesConsulted ?? [],
        architectureVersion: dto.architectureVersion ?? null,
        constitutionVersion: dto.constitutionVersion ?? null,
        recommendedOption: dto.recommendedOption,
        justification: dto.justification,
        confidenceLevel: dto.confidenceLevel,
        unknownsCount: dto.unknownsCount ?? null,
        unknownsCritical: dto.unknownsCritical ?? null,
        expectedOutcome: dto.expectedOutcome ?? null,
        debtForecast: dto.debtForecast ?? null,
        timelineToValue: dto.timelineToValue ?? null,
        prerequisites: dto.prerequisites ?? [],
        whenToRevisit: dto.whenToRevisit ?? null,
        successCriteria: dto.successCriteria ?? [],
        riskMitigations: dto.riskMitigations ?? [],
        reasoningTrace: dto.reasoningTrace ?? null,
        advisoryReportRef: dto.advisoryReportRef ?? null,
        modelVersion: dto.modelVersion ?? null,

        // 2. Server-controlled analytics fields (safe defaults only)
        confidenceScore: analytics?.confidenceScore ?? 0,
        weightedScore: analytics?.weightedScore ?? 0,
        scoreMargin: analytics?.scoreMargin ?? 0,
        ecs: analytics?.ecs ?? null,
        sqs: analytics?.sqs ?? null,
        cs: analytics?.cs ?? null,

        // 3. Relation/nested fields
        escalationHistory: escalationHistory as Prisma.InputJsonValue,
        predictedRisks: predictedRisks as Prisma.InputJsonValue,
        options: options
          ? {
              create: options.map((opt) => ({
                label: opt.label,
                description: opt.description,
                score: opt.score,
              })),
            }
          : undefined,
      },
      include: { options: true, checkpoints: true },
    });

    return recommendation;
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    mode?: string;
    decisionType?: string;
    decisionDomain?: string;
    trackingStatus?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (params.mode) where.mode = params.mode;
    if (params.decisionType) where.decisionType = params.decisionType;
    if (params.decisionDomain) where.decisionDomain = params.decisionDomain;
    if (params.trackingStatus) where.trackingStatus = params.trackingStatus;

    const [items, total] = await Promise.all([
      this.prisma.recommendation.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 20,
        orderBy: { createdAt: 'desc' },
        include: { options: true, checkpoints: true },
      }),
      this.prisma.recommendation.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string) {
    const recommendation = await this.prisma.recommendation.findUnique({
      where: { id },
      include: { options: true, checkpoints: { orderBy: { scheduleAt: 'asc' } } },
    });
    if (!recommendation) {
      throw new NotFoundException(`Recommendation ${id} not found`);
    }
    return recommendation;
  }

  async findByRecId(recId: string) {
    const recommendation = await this.prisma.recommendation.findUnique({
      where: { recId },
      include: { options: true, checkpoints: { orderBy: { scheduleAt: 'asc' } } },
    });
    if (!recommendation) {
      throw new NotFoundException(`Recommendation ${recId} not found`);
    }
    return recommendation;
  }

  async updateStatus(id: string, trackingStatus: string) {
    const recommendation = await this.findById(id);

    const data: Record<string, unknown> = { trackingStatus };

    // Create checkpoints when transitioning to IN_PROGRESS
    if (
      trackingStatus === 'IN_PROGRESS' &&
      recommendation.trackingStatus === 'PENDING'
    ) {
      const now = new Date();
      const checkpoints = [
        { checkpoint: '30D', scheduleAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
        { checkpoint: '90D', scheduleAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) },
        { checkpoint: '180D', scheduleAt: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000) },
      ];

      for (const cp of checkpoints) {
        await this.prisma.checkpoint.upsert({
          where: {
            recommendationId_checkpoint: {
              recommendationId: id,
              checkpoint: cp.checkpoint,
            },
          },
          update: { scheduleAt: cp.scheduleAt },
          create: {
            recommendationId: id,
            checkpoint: cp.checkpoint,
            scheduleAt: cp.scheduleAt,
          },
        });
      }
    }

    return this.prisma.recommendation.update({
      where: { id },
      data,
      include: { options: true, checkpoints: true },
    });
  }

  async setFinalOutcome(
    id: string,
    finalOutcome: string,
    assessedAt: Date = new Date(),
  ) {
    return this.prisma.recommendation.update({
      where: { id },
      data: {
        trackingStatus: 'ASSESSED',
        finalOutcome,
        assessedAt,
      },
      include: { options: true, checkpoints: true },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.recommendation.delete({ where: { id } });
  }

  /**
   * Count recommendations by status for dashboard summary.
   */
  async countByStatus() {
    const groups = await this.prisma.recommendation.groupBy({
      by: ['trackingStatus'],
      _count: true,
    });
    const result: Record<string, number> = {
      PENDING: 0,
      IN_PROGRESS: 0,
      ASSESSED: 0,
    };
    for (const g of groups) {
      result[g.trackingStatus] = g._count;
    }
    return result;
  }
}
