/* @lifecycle ACTIVE — Scheduler for periodic drift detection (ADR-013) */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DriftDetectorService } from '../services/drift-detector.service';

@Injectable()
export class DriftScheduler {
  private readonly logger = new Logger(DriftScheduler.name);

  constructor(private readonly driftDetectorService: DriftDetectorService) {}

  /**
   * Every 6 hours — run full drift detection across all strategies.
   * Executes at minute 0 of every 6th hour via CronExpression.EVERY_6_HOURS.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledDriftDetection() {
    this.logger.log('Running scheduled drift detection (6-hour interval)...');

    try {
      const events = await this.driftDetectorService.runFullDetection();
      this.logger.log(
        `Scheduled drift detection complete: ${events.length} new drift events recorded`,
      );

      // Log severe drifts at warning level for operational visibility
      const criticalCount = events.filter(
        (e) => e.severity === 'CRITICAL' || e.severity === 'HIGH',
      ).length;
      if (criticalCount > 0) {
        this.logger.warn(
          `${criticalCount} high/critical severity drift event(s) detected`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Scheduled drift detection failed: ${(error as Error).message}`,
      );
    }
  }
}
