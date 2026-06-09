/* @lifecycle ACTIVE — Cron scheduler for knowledge graph file scanning */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { KnowledgeSyncService } from '../services/knowledge-sync.service';

@Injectable()
export class KnowledgeSyncScheduler {
  private readonly logger = new Logger(KnowledgeSyncScheduler.name);

  constructor(
    private readonly syncService: KnowledgeSyncService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Scheduled sync every 12 hours.
   * Only runs when KNOWLEDGE_AUTO_SYNC env variable is set to 'true'.
   */
  @Cron(CronExpression.EVERY_12_HOURS)
  async handleSync() {
    if (this.configService.get<string>('KNOWLEDGE_AUTO_SYNC') !== 'true') {
      this.logger.debug('Auto-sync disabled (KNOWLEDGE_AUTO_SYNC != true)');
      return;
    }

    this.logger.log('Starting scheduled knowledge graph sync...');
    try {
      const result = await this.syncService.syncFromFileScan();
      this.logger.log(
        `Scheduled sync complete: ${result.nodesCreated} nodes, ${result.edgesCreated} edges created`,
      );
      if (result.errors.length > 0) {
        this.logger.warn(
          `Sync completed with ${result.errors.length} non-fatal errors`,
        );
      }
    } catch (error) {
      this.logger.error(`Scheduled sync failed: ${(error as Error).message}`);
    }
  }
}
