// @lifecycle ACTIVE — Checkpoint scheduling and assessment service

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpdateCheckpointDto } from '../dto/update-checkpoint.dto';

@Injectable()
export class CheckpointService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create or update a checkpoint assessment for a recommendation.
   */
  async upsertCheckpoint(
    recommendationId: string,
    dto: UpdateCheckpointDto,
  ) {
    const recommendation = await this.prisma.recommendation.findUnique({
      where: { id: recommendationId },
    });
    if (!recommendation) {
      throw new NotFoundException(
        `Recommendation ${recommendationId} not found`,
      );
    }

    const checkpoint = await this.prisma.checkpoint.upsert({
      where: {
        recommendationId_checkpoint: {
          recommendationId,
          checkpoint: dto.checkpoint,
        },
      },
      update: {
        evaluatedAt: new Date(),
        evaluator: dto.evaluator ?? 'ask',
        evidenceSources: dto.evidenceSources,
        wasImplemented: dto.wasImplemented,
        implementedOption: dto.implementedOption,
        implementationFaith: dto.implementationFaith,
        divergenceReason: dto.divergenceReason,
        problemSolved: dto.problemSolved,
        solutionScore: dto.solutionScore,
        debtIntroduced: dto.debtIntroduced,
        performanceImpact: dto.performanceImpact,
        teamSatisfaction: dto.teamSatisfaction,
        risksMaterialized: (dto.risksMaterialized ?? undefined) as Prisma.InputJsonValue,
        risksAvoided: (dto.risksAvoided ?? undefined) as Prisma.InputJsonValue,
        missedRisks: (dto.missedRisks ?? undefined) as Prisma.InputJsonValue,
        riskAssessmentAcc: dto.riskAssessmentAcc,
        forecastAccurate: dto.forecastAccurate,
        forecastDeviation: dto.forecastDeviation,
        timelineAccurate: dto.timelineAccurate,
        wasReplaced: dto.wasReplaced,
        replacementReason: dto.replacementReason,
        wasReversedByAdr: dto.wasReversedByAdr,
        checkpointVerdict: dto.checkpointVerdict,
        verdictConfidence: dto.verdictConfidence,
        notes: dto.notes,
        completedAt: new Date(),
      },
      create: {
        recommendationId,
        checkpoint: dto.checkpoint,
        scheduleAt: new Date(),
        evaluatedAt: new Date(),
        evaluator: dto.evaluator ?? 'ask',
        evidenceSources: dto.evidenceSources ?? [],
        wasImplemented: dto.wasImplemented,
        implementedOption: dto.implementedOption,
        implementationFaith: dto.implementationFaith,
        divergenceReason: dto.divergenceReason,
        problemSolved: dto.problemSolved,
        solutionScore: dto.solutionScore,
        debtIntroduced: dto.debtIntroduced,
        performanceImpact: dto.performanceImpact,
        teamSatisfaction: dto.teamSatisfaction,
        risksMaterialized: (dto.risksMaterialized ?? undefined) as Prisma.InputJsonValue,
        risksAvoided: (dto.risksAvoided ?? undefined) as Prisma.InputJsonValue,
        missedRisks: (dto.missedRisks ?? undefined) as Prisma.InputJsonValue,
        riskAssessmentAcc: dto.riskAssessmentAcc,
        forecastAccurate: dto.forecastAccurate,
        forecastDeviation: dto.forecastDeviation,
        timelineAccurate: dto.timelineAccurate,
        wasReplaced: dto.wasReplaced,
        replacementReason: dto.replacementReason,
        wasReversedByAdr: dto.wasReversedByAdr,
        checkpointVerdict: dto.checkpointVerdict,
        verdictConfidence: dto.verdictConfidence,
        notes: dto.notes,
        completedAt: new Date(),
      },
    });

    // After upserting, check if all checkpoints are done → transition to ASSESSED
    await this.checkAndTransition(recommendationId);

    return checkpoint;
  }

  /**
   * Find all checkpoints that are due (scheduleAt <= now) and not yet evaluated.
   */
  async findDueCheckpoints() {
    return this.prisma.checkpoint.findMany({
      where: {
        evaluatedAt: null,
        scheduleAt: { lte: new Date() },
      },
      include: {
        recommendation: {
          select: {
            id: true,
            recId: true,
            decisionDomain: true,
            trackingStatus: true,
          },
        },
      },
      orderBy: { scheduleAt: 'asc' },
    });
  }

  /**
   * Get all checkpoints for a recommendation.
   */
  async findByRecommendationId(recommendationId: string) {
    return this.prisma.checkpoint.findMany({
      where: { recommendationId },
      orderBy: { scheduleAt: 'asc' },
    });
  }

  /**
   * Quick assessment from codebase signals (git log, ADRs, etc.).
   * Placeholder for automated evidence gathering.
   */
  async autoAssess(recommendationId: string) {
    const recommendation = await this.prisma.recommendation.findUnique({
      where: { id: recommendationId },
    });
    if (!recommendation) {
      throw new NotFoundException(`Recommendation ${recommendationId} not found`);
    }

    // TODO: Implement actual evidence gathering from:
    //   - Git log (was technology introduced/reverted?)
    //   - ADRs (was decision reversed?)
    //   - Codebase drift detection
    //
    // For now, this is a no-op placeholder that returns the recommendation
    // with a note that automated assessment was attempted but no evidence found.

    return {
      recommendationId,
      message: 'Auto-assessment attempted — no automated evidence gathered. Manual assessment required.',
      confidence: 'LOW',
    };
  }

  private async checkAndTransition(recommendationId: string) {
    const checkpoints = await this.prisma.checkpoint.findMany({
      where: { recommendationId },
    });

    type CheckpointResult = { evaluatedAt: Date | null; checkpointVerdict: string | null };
    const allAssessed = checkpoints.every((cp: CheckpointResult) => cp.evaluatedAt !== null);
    if (!allAssessed) return;

    // All three checkpoints done: determine final outcome
    const verdicts = checkpoints
      .filter((cp: CheckpointResult) => cp.checkpointVerdict !== null)
      .map((cp: CheckpointResult) => cp.checkpointVerdict);

    let finalOutcome = 'SUCCESS';
    if (verdicts.includes('FAILED')) {
      finalOutcome = 'FAILURE';
    } else if (verdicts.includes('PROBLEM')) {
      finalOutcome = 'MIXED';
    } else if (verdicts.includes('CONCERN')) {
      finalOutcome = 'MIXED';
    }

    await this.prisma.recommendation.update({
      where: { id: recommendationId },
      data: {
        trackingStatus: 'ASSESSED',
        finalOutcome,
        assessedAt: new Date(),
      },
    });
  }
}
