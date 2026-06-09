// @lifecycle ACTIVE — CRUD service for agent execution traces and phases

import {
  Injectable, Logger, NotFoundException, ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateExecutionDto } from '../dto/create-execution.dto';
import { CreatePhaseDto } from '../dto/create-phase.dto';
import { QueryExecutionsDto } from '../dto/query-executions.dto';

@Injectable()
export class ExecutionTraceService {
  private readonly logger = new Logger(ExecutionTraceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new execution trace with idempotency check on executionId.
   */
  async create(dto: CreateExecutionDto) {
    // Idempotency check
    const existing = await this.prisma.agentExecution.findUnique({
      where: { executionId: dto.executionId },
    });
    if (existing) {
      throw new ConflictException(
        `Execution with executionId "${dto.executionId}" already exists`,
      );
    }

    return this.prisma.agentExecution.create({
      data: {
        executionId: dto.executionId,
        requestSummary: dto.requestSummary,
        routerRoute: dto.routerRoute,
        routerConfidence: dto.routerConfidence,
        routerRisk: dto.routerRisk,
        routerReason: dto.routerReason,
        planSummary: dto.planSummary ?? null,
        planTaskCount: dto.planTaskCount ?? null,
        archReviewed: dto.archReviewed ?? false,
        archRevisionNeeded: dto.archRevisionNeeded ?? false,
        preVerifyDecision: dto.preVerifyDecision ?? null,
        preVerifyFlags: (dto.preVerifyFlags as Prisma.InputJsonValue) ?? undefined,
        codeAttempts: dto.codeAttempts ?? 0,
        codeFirstAttemptSuccess: dto.codeFirstAttemptSuccess ?? null,
        postVerifyDecision: dto.postVerifyDecision ?? null,
        postVerifyIssues: (dto.postVerifyIssues as Prisma.InputJsonValue) ?? undefined,
        retryCount: dto.retryCount ?? 0,
        debugSuccess: dto.debugSuccess ?? null,
        finalOutcome: dto.finalOutcome,
        totalDurationMs: dto.totalDurationMs ?? null,
        committedAt: dto.committedAt ? new Date(dto.committedAt) : null,
      },
    });
  }

  /**
   * Find all executions with pagination and optional filters.
   */
  async findAll(params: QueryExecutionsDto) {
    const skip = params.skip ? parseInt(params.skip, 10) : 0;
    const take = params.take ? parseInt(params.take, 10) : 20;

    const where: Prisma.AgentExecutionWhereInput = {};

    if (params.routerRoute) {
      where.routerRoute = params.routerRoute;
    }
    if (params.finalOutcome) {
      where.finalOutcome = params.finalOutcome;
    }
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) {
        where.createdAt.gte = new Date(params.from);
      }
      if (params.to) {
        where.createdAt.lte = new Date(params.to);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.agentExecution.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { phases: { orderBy: { phaseOrder: 'asc' } } },
      }),
      this.prisma.agentExecution.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Find a single execution by its executionId (not Prisma id).
   */
  async findByExecutionId(executionId: string) {
    const execution = await this.prisma.agentExecution.findUnique({
      where: { executionId },
      include: { phases: { orderBy: { phaseOrder: 'asc' } } },
    });

    if (!execution) {
      throw new NotFoundException(
        `Execution with executionId "${executionId}" not found`,
      );
    }

    return execution;
  }

  /**
   * Add a phase to an existing execution, identified by executionId.
   * Resolves the Prisma id internally via a preliminary findUnique.
   */
  async addPhase(executionId: string, dto: CreatePhaseDto) {
    // Resolve execution by executionId
    const execution = await this.prisma.agentExecution.findUnique({
      where: { executionId },
    });

    if (!execution) {
      throw new NotFoundException(
        `Execution with executionId "${executionId}" not found`,
      );
    }

    // Check phaseId uniqueness
    const existingPhase = await this.prisma.executionPhase.findUnique({
      where: { phaseId: dto.phaseId },
    });
    if (existingPhase) {
      throw new ConflictException(
        `Phase with phaseId "${dto.phaseId}" already exists`,
      );
    }

    return this.prisma.executionPhase.create({
      data: {
        phaseId: dto.phaseId,
        executionId: execution.id,
        agentType: dto.agentType,
        phaseOrder: dto.phaseOrder,
        input: (dto.input as Prisma.InputJsonValue) ?? undefined,
        output: (dto.output as Prisma.InputJsonValue) ?? undefined,
        decision: dto.decision ?? null,
        decisionReason: dto.decisionReason ?? null,
        durationMs: dto.durationMs ?? null,
        modelUsed: dto.modelUsed ?? null,
        transitionedTo: dto.transitionedTo ?? null,
      },
    });
  }

  /**
   * Delete an execution trace by Prisma id.
   */
  async remove(id: string) {
    const execution = await this.prisma.agentExecution.findUnique({
      where: { id },
    });

    if (!execution) {
      throw new NotFoundException(`Execution with id "${id}" not found`);
    }

    return this.prisma.agentExecution.delete({
      where: { id },
      include: { phases: true },
    });
  }

  /**
   * Count executions grouped by finalOutcome.
   * Returns a zero-initialized map for all known outcomes.
   */
  async countByOutcome(): Promise<Record<string, number>> {
    const outcomes = ['COMMITTED', 'BLOCKED', 'FAILED', 'ABANDONED'];
    const result: Record<string, number> = {};

    // Initialize all outcomes to 0
    for (const outcome of outcomes) {
      result[outcome] = 0;
    }

    const grouped = await this.prisma.agentExecution.groupBy({
      by: ['finalOutcome'],
      _count: { id: true },
    });

    for (const group of grouped) {
      result[group.finalOutcome] = group._count.id;
    }

    return result;
  }
}
