// @lifecycle ACTIVE — Evaluation harness REST controller

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExecutionTraceService } from './services/execution-trace.service';
import { MetricService } from './services/metric.service';
import { DriftDetectorService } from './services/drift-detector.service';
import { AnalyticsService } from './services/analytics.service';
import { SelfHealService } from './services/self-heal.service';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { QueryMetricsDto } from './dto/query-metrics.dto';
import { QueryExecutionsDto } from './dto/query-executions.dto';
import { QueryDriftEventsDto } from './dto/query-drift-events.dto';
import { DetectorType, Severity } from './interfaces/drift-detector.interface';
import { QueryAnalyticsDto } from './dto/query-analytics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Evaluation')
@ApiBearerAuth('JWT-auth')
@Controller('evaluations')
@UseGuards(JwtAuthGuard)
export class EvaluationController {
  constructor(
    private readonly executionTraceService: ExecutionTraceService,
    private readonly metricService: MetricService,
    private readonly driftDetectorService: DriftDetectorService,
    private readonly analyticsService: AnalyticsService,
    private readonly selfHealService: SelfHealService,
  ) {}

  // ─── Static routes (must precede :id routes) ──────────────────────────────

  @Post('executions')
  @ApiOperation({ summary: 'Create an agent execution trace' })
  async createExecution(@Body() dto: CreateExecutionDto) {
    const execution = await this.executionTraceService.create(dto);

    // Activate the post-commit hook for COMMITTED executions
    // Fire-and-forget: onExecutionCommitted internally catches and logs errors
    if (dto.finalOutcome === 'COMMITTED') {
      this.metricService.onExecutionCommitted(execution.executionId);
    }

    return execution;
  }

  @Get('executions')
  @ApiOperation({ summary: 'List execution traces with optional filters' })
  findAllExecutions(@Query() query: QueryExecutionsDto) {
    return this.executionTraceService.findAll(query);
  }

  @Post('executions/:executionId/phases')
  @ApiOperation({ summary: 'Add a phase to an execution trace' })
  addPhase(
    @Param('executionId') executionId: string,
    @Body() dto: CreatePhaseDto,
  ) {
    return this.executionTraceService.addPhase(executionId, dto);
  }

  @Get('metrics/summary')
  @ApiOperation({ summary: 'Get execution metrics summary' })
  getSummary() {
    return this.metricService.getSummary();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get detailed agent metrics with filters' })
  getMetrics(@Query() query: QueryMetricsDto) {
    return this.metricService.getMetrics(query);
  }

  @Post('metrics/recalculate')
  @ApiOperation({ summary: 'Recalculate all metrics' })
  recalculateMetrics() {
    return this.metricService.recomputeAll('ALL_TIME');
  }

  // ─── Analytics endpoints (ADR-014) ─────────────────────────────────────

  @Get('analytics/agent-performance')
  @ApiOperation({ summary: 'Agent success rates and average durations' })
  getAgentPerformance(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getAgentPerformance(query);
  }

  @Get('analytics/throughput')
  @ApiOperation({ summary: 'Executions per time window' })
  getThroughput(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getThroughput(query);
  }

  @Get('analytics/bottlenecks')
  @ApiOperation({ summary: 'Slowest phases and most retried stages' })
  getBottlenecks(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getBottlenecks(query);
  }

  @Get('analytics/cost-trends')
  @ApiOperation({ summary: 'Daily/weekly cost trends from CostLog' })
  getCostTrends(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getCostTrends(query);
  }

  @Get('drift')
  @ApiOperation({ summary: 'Query drift events with optional filters' })
  queryDriftEvents(@Query() query: QueryDriftEventsDto) {
    return this.driftDetectorService.queryEvents({
      detectorType: query.detectorType as DetectorType,
      severity: query.severity as Severity,
      isResolved: query.isResolved,
      skip: query.skip,
      take: query.take,
    });
  }

  @Post('drift/detect')
  @ApiOperation({ summary: 'Trigger a full drift detection cycle' })
  triggerDriftDetection() {
    return this.driftDetectorService.runFullDetection();
  }

  // ─── Self-Heal endpoints ──────────────────────────────────────────────────

  @Post('self-heal')
  @ApiOperation({ summary: 'Retry all failed executions (max 2 retries)' })
  retryAllFailed() {
    return this.selfHealService.retryAllFailed();
  }

  // ─── Parameterized routes (must follow static routes) ─────────────────────

  @Post('self-heal/:executionId')
  @ApiOperation({ summary: 'Retry a single failed execution by ID' })
  retryFailedExecution(@Param('executionId') executionId: string) {
    return this.selfHealService.retryFailedExecution(executionId);
  }

  @Get('executions/:executionId')

  @Get('executions/:executionId')
  @ApiOperation({ summary: 'Get an execution trace by ID' })
  findExecution(@Param('executionId') executionId: string) {
    return this.executionTraceService.findByExecutionId(executionId);
  }
}
