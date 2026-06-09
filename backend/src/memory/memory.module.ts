/* @lifecycle ACTIVE — Memory module (TASK-029) — extended with Context Manager (ADR-012) */

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MemoryController } from './memory.controller';
import { MemoryService } from './services/memory.service';
import { ContextManagerService } from './services/context-manager.service';
import { MemoryScheduler } from './schedulers/memory.scheduler';

@Module({
  imports: [
    ScheduleModule,
    CacheModule.register({ ttl: 300, max: 100 }),
    KnowledgeModule,
  ],
  controllers: [MemoryController],
  providers: [
    MemoryService,
    ContextManagerService,
    MemoryScheduler,
  ],
  exports: [MemoryService, ContextManagerService],
})
export class MemoryModule {}
