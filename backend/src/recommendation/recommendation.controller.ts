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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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

@ApiTags('Recommendations')
@ApiBearerAuth('JWT-auth')
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
  @ApiOperation({ summary: 'Create a new recommendation' })
  create(@Body() dto: CreateRecommendationDto) {
    return this.recommendationService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List recommendations with optional filters' })
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
  @ApiOperation({ summary: 'Get accuracy metrics and stats' })
  getStats() {
    return this.accuracyService.computeMetrics();
  }

  @Get('status-summary')
  @ApiOperation({ summary: 'Get recommendation counts by tracking status' })
  getStatusSummary() {
    return this.recommendationService.countByStatus();
  }

  // ─── Executive Review (must precede :id to avoid route capture) ───

  @Get('executive-review')
  @ApiOperation({ summary: 'Generate executive review report' })
  getExecutiveReview() {
    return this.executiveReviewService.generateReport();
  }

  // ─── Trust Scores (must precede :id to avoid route capture) ───────────

  @Get('trust-scores')
  @ApiOperation({ summary: 'Get trust scores with optional filters' })
  getTrustScores(
    @Query('level') level?: string,
    @Query('domain') domain?: string,
    @Query('decisionType') decisionType?: string,
  ) {
    return this.trustScoreService.getFiltered({ level, domain, decisionType });
  }

  @Post('trust-scores/recalculate')
  @ApiOperation({ summary: 'Recalculate all trust scores' })
  recalculateTrustScores() {
    return this.trustScoreService.recalculateAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a recommendation by ID' })
  findById(@Param('id') id: string) {
    return this.recommendationService.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update a recommendation tracking status' })
  updateStatus(
    @Param('id') id: string,
    @Body('trackingStatus') trackingStatus: string,
  ) {
    return this.recommendationService.updateStatus(id, trackingStatus);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a recommendation' })
  remove(@Param('id') id: string) {
    return this.recommendationService.remove(id);
  }

  // ─── Checkpoints ──────────────────────────────────────────────────────────

  @Post(':id/checkpoints')
  @ApiOperation({ summary: 'Upsert a checkpoint for a recommendation' })
  upsertCheckpoint(
    @Param('id') id: string,
    @Body() dto: UpdateCheckpointDto,
  ) {
    return this.checkpointService.upsertCheckpoint(id, dto);
  }

  @Get(':id/checkpoints')
  @ApiOperation({ summary: 'Get checkpoints for a recommendation' })
  getCheckpoints(@Param('id') id: string) {
    return this.checkpointService.findByRecommendationId(id);
  }

  // ─── Decision Memory ──────────────────────────────────────────────────────

  @Get('decision-memory')
  @ApiOperation({ summary: 'Query decision memory or get domain summary' })
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
  @ApiOperation({ summary: 'Get latest accuracy snapshot' })
  getLatestSnapshot() {
    return this.accuracyService.getLatestSnapshot();
  }

  @Post('accuracy-snapshots')
  @ApiOperation({ summary: 'Create a new accuracy snapshot' })
  createSnapshot() {
    return this.accuracyService.createSnapshot();
  }

  // ─── Ask Integration ──────────────────────────────────────────────────────

  @Post('ask-ingest')
  @ApiOperation({ summary: 'Ingest a text snippet from Ask' })
  ingestFromAsk(@Body('text') text: string) {
    return this.askIngestService.ingestFromText(text);
  }
}
