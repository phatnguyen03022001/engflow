// @lifecycle ACTIVE — Recommendation registry REST controller

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RecommendationService } from './services/recommendation.service';
import { CheckpointService } from './services/checkpoint.service';
import { TrustScoreService } from './services/trust-score.service';
import { AccuracyService } from './services/accuracy.service';
import { DecisionMemoryService } from './services/decision-memory.service';
import { ExecutiveReviewService } from './services/executive-review.service';
import { AskIngestService } from './services/ask-ingest.service';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { AccuracyQueryDto } from './dto/accuracy-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('recommendations')
@UseGuards(JwtAuthGuard)
export class RecommendationController {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly checkpointService: CheckpointService,
    private readonly trustScoreService: TrustScoreService,
    private readonly accuracyService: AccuracyService,
    private readonly decisionMemoryService: DecisionMemoryService,
    private readonly executiveReviewService: ExecutiveReviewService,
    private readonly askIngestService: AskIngestService,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  @Post()
  create(@Body() dto: CreateRecommendationDto) {
    return this.recommendationService.create(dto);
  }

  @Get()
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('mode') mode?: string,
    @Query('decisionType') decisionType?: string,
    @Query('decisionDomain') decisionDomain?: string,
    @Query('trackingStatus') trackingStatus?: string,
  ) {
    return this.recommendationService.findAll({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      mode,
      decisionType,
      decisionDomain,
      trackingStatus,
    });
  }

  @Get('stats')
  getStats() {
    return this.accuracyService.computeMetrics();
  }

  @Get('status-summary')
  getStatusSummary() {
    return this.recommendationService.countByStatus();
  }

  // ─── Executive Review (must precede :id to avoid route capture) ───

  @Get('executive-review')
  getExecutiveReview() {
    return this.executiveReviewService.generateReport();
  }

  // ─── Trust Scores (must precede :id to avoid route capture) ───────────

  @Get('trust-scores')
  getTrustScores(
    @Query('level') level?: string,
    @Query('domain') domain?: string,
    @Query('decisionType') decisionType?: string,
  ) {
    return this.trustScoreService.getFiltered({ level, domain, decisionType });
  }

  @Post('trust-scores/recalculate')
  recalculateTrustScores() {
    return this.trustScoreService.recalculateAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.recommendationService.findById(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('trackingStatus') trackingStatus: string,
  ) {
    return this.recommendationService.updateStatus(id, trackingStatus);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.recommendationService.remove(id);
  }

  // ─── Checkpoints ──────────────────────────────────────────────────────────

  @Post(':id/checkpoints')
  upsertCheckpoint(
    @Param('id') id: string,
    @Body() dto: UpdateCheckpointDto,
  ) {
    return this.checkpointService.upsertCheckpoint(id, dto);
  }

  @Get(':id/checkpoints')
  getCheckpoints(@Param('id') id: string) {
    return this.checkpointService.findByRecommendationId(id);
  }

  // ─── Decision Memory ──────────────────────────────────────────────────────

  @Get('decision-memory')
  getDecisionMemory(
    @Query('domain') domain?: string,
    @Query('techStack') techStack?: string,
    @Query('scale') scale?: string,
    @Query('projectId') projectId?: string,
  ) {
    if (domain) {
      return this.decisionMemoryService.queryWithApplicability(domain, {
        techStack,
        scale,
        projectId,
      });
    }
    return this.decisionMemoryService.getDomainSummary();
  }

  // ─── Accuracy Snapshots ───────────────────────────────────────────────────

  @Get('accuracy-snapshots/latest')
  getLatestSnapshot() {
    return this.accuracyService.getLatestSnapshot();
  }

  @Post('accuracy-snapshots')
  createSnapshot() {
    return this.accuracyService.createSnapshot();
  }

  // ─── Ask Integration ──────────────────────────────────────────────────────

  @Post('ask-ingest')
  ingestFromAsk(@Body('text') text: string) {
    return this.askIngestService.ingestFromText(text);
  }
}
