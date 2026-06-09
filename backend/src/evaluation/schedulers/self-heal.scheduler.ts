/* @lifecycle ACTIVE — Scheduler for periodic self-heal retry */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SelfHealService } from '../services/self-heal.service';

@Injectable()
export class SelfHealScheduler {
  private readonly logger = new Logger(SelfHealScheduler.name);

  constructor(private readonly selfHealService: SelfHealService) {}

  /**
   * Every 30 minutes — retry all failed executions that haven't exceeded max retries.
   * Executes at minute 0 of every 30th minute.
   */
  @Cron('0 */30 * * * *')
  async scheduledSelfHeal() {
    this.logger.log('Running scheduled self-heal (30-minute interval)...');

    try {
      const summary = await this.selfHealService.retryAllFailed();
      this.logger.log(
        `Self-heal complete: ${summary.retried} retried, ` +
          `${summary.skipped} skipped, ${summary.errors} errors (${summary.total} total)`,
      );
    } catch (error) {
      this.logger.error(
        `Scheduled self-heal failed: ${(error as Error).message}`,
      );
    }
  }
}
