/* @lifecycle ACTIVE — Knowledge Graph module for cross-layer traceability */

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeGraphService } from './services/knowledge-graph.service';
import { KnowledgeSyncService } from './services/knowledge-sync.service';
import { KnowledgeSyncScheduler } from './schedulers/knowledge-sync.scheduler';

@Module({
  imports: [ScheduleModule],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeGraphService,
    KnowledgeSyncService,
    KnowledgeSyncScheduler,
  ],
  exports: [KnowledgeGraphService],
})
export class KnowledgeModule {}
