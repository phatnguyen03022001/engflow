// @lifecycle ACTIVE — Recommendation registry module

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './services/recommendation.service';
import { CheckpointService } from './services/checkpoint.service';
import { TrustScoreService } from './services/trust-score.service';
import { AccuracyService } from './services/accuracy.service';
import { DecisionMemoryService } from './services/decision-memory.service';
import { ExecutiveReviewService } from './services/executive-review.service';
import { AskIngestService } from './services/ask-ingest.service';
import { CheckpointScheduler } from './schedulers/checkpoint.scheduler';
import { AccuracyScheduler } from './schedulers/accuracy.scheduler';

@Module({
  imports: [ScheduleModule],
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    CheckpointService,
    TrustScoreService,
    AccuracyService,
    DecisionMemoryService,
    ExecutiveReviewService,
    AskIngestService,
    CheckpointScheduler,
    AccuracyScheduler,
  ],
  exports: [
    RecommendationService,
    TrustScoreService,
    DecisionMemoryService,
  ],
})
export class RecommendationModule {}
