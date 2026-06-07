// @lifecycle ACTIVE — Root application module

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { LearningModule } from './learning/learning.module';
import { SharedModule } from './shared/shared.module';
import { RecommendationModule } from './recommendation/recommendation.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SharedModule,
    AuthModule,
    UserModule,
    LearningModule,
    RecommendationModule,
  ],
})
export class AppModule {}
