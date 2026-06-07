// @lifecycle ACTIVE — Core recommendation registry service

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateRecommendationDto } from '../dto/create-recommendation.dto';

@Injectable()
export class RecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRecommendationDto) {
    const existing = await this.prisma.recommendation.findUnique({
      where: { recId: dto.recId },
    });
    if (existing) {
      throw new ConflictException(
        `Recommendation ${dto.recId} already exists`,
      );
    }

    const { options, escalationHistory, predictedRisks, ...data } = dto;

    const recommendation = await this.prisma.recommendation.create({
      data: {
        ...data,
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
