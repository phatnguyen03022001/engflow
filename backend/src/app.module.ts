// @lifecycle ACTIVE — Root application module

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { LearningModule } from './learning/learning.module';
import { SharedModule } from './shared/shared.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { MemoryModule } from './memory/memory.module';
import { ModelRegistryModule } from './model-registry/model-registry.module';
import { KnowledgeModule } from './knowledge/knowledge.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SharedModule,
    AuthModule,
    UserModule,
    LearningModule,
    RecommendationModule,
    MemoryModule,
    EvaluationModule,
    ModelRegistryModule,
    KnowledgeModule,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
