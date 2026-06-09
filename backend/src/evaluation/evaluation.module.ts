// @lifecycle ACTIVE — Agent evaluation harness module

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MemoryModule } from '../memory/memory.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { ModelRegistryModule } from '../model-registry/model-registry.module';
import { EvaluationController } from './evaluation.controller';
import { ExecutionTraceService } from './services/execution-trace.service';
import { MetricService } from './services/metric.service';
import { RouterEvaluatorService } from './services/router-evaluator.service';
import { PlannerEvaluatorService } from './services/planner-evaluator.service';
import { CodeEvaluatorService } from './services/code-evaluator.service';
import { DriftDetectorService } from './services/drift-detector.service';
import { AnalyticsService } from './services/analytics.service';
import { SelfHealService } from './services/self-heal.service';
import { MetricScheduler } from './schedulers/metric.scheduler';
import { DriftScheduler } from './schedulers/drift.scheduler';
import { SelfHealScheduler } from './schedulers/self-heal.scheduler';

@Module({
  imports: [ScheduleModule, MemoryModule, RecommendationModule, ModelRegistryModule],
  controllers: [EvaluationController],
  providers: [
    ExecutionTraceService,
    MetricService,
    RouterEvaluatorService,
    PlannerEvaluatorService,
    CodeEvaluatorService,
    DriftDetectorService,
    AnalyticsService,
    SelfHealService,
    MetricScheduler,
    DriftScheduler,
    SelfHealScheduler,
  ],
  exports: [MetricService],
})
export class EvaluationModule {}
