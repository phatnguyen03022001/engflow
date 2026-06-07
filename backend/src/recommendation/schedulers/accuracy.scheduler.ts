// @lifecycle ACTIVE — Scheduler for periodic accuracy snapshots

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccuracyService } from '../services/accuracy.service';
import { TrustScoreService } from '../services/trust-score.service';

@Injectable()
export class AccuracyScheduler {
  private readonly logger = new Logger(AccuracyScheduler.name);

  constructor(
    private readonly accuracyService: AccuracyService,
    private readonly trustScoreService: TrustScoreService,
  ) {}

  /**
   * Daily at 01:00 — create accuracy snapshot and recalculate trust scores.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async dailyAccuracyUpdate() {
    this.logger.log('Running daily accuracy update...');

    try {
      // Create accuracy snapshot
      const snapshot = await this.accuracyService.createSnapshot();
      this.logger.log(
        `Accuracy snapshot created: ${snapshot.id} (assessed: ${snapshot.totalAssessed}, accuracy: ${snapshot.overallAccuracy}%)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create accuracy snapshot: ${(error as Error).message}`,
      );
    }

    try {
      // Recalculate trust scores
      await this.trustScoreService.recalculateAll();
      this.logger.log('Trust scores recalculated');
    } catch (error) {
      this.logger.error(
        `Failed to recalculate trust scores: ${(error as Error).message}`,
      );
    }
  }
}
