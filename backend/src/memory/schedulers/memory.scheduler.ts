/* @lifecycle ACTIVE — Memory decay and cleanup scheduler (TASK-029) */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MemoryService } from '../services/memory.service';

@Injectable()
export class MemoryScheduler {
  private readonly logger = new Logger(MemoryScheduler.name);

  constructor(private readonly memoryService: MemoryService) {}

  /**
   * Daily at 3:00 AM — decay all memory weights.
   */
  @Cron('0 3 * * *')
  async handleDecay() {
    this.logger.log('Running scheduled memory decay...');
    await this.memoryService.decayAll();
    this.logger.log('Memory decay completed');
  }

  /**
   * Daily at 3:05 AM — clean up stale memory entries.
   * Runs 5 minutes after decay to allow weight recalculation first.
   */
  @Cron('5 3 * * *')
  async handleCleanup() {
    this.logger.log('Running scheduled memory cleanup...');
    const count = await this.memoryService.cleanupStale();
    this.logger.log(`Memory cleanup completed: ${count} entries removed`);
  }
}
