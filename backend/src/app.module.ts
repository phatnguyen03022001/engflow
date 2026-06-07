// @lifecycle ACTIVE — Root application module

import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { LearningModule } from './learning/learning.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [SharedModule, AuthModule, UserModule, LearningModule],
})
export class AppModule {}
