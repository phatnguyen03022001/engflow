/* @lifecycle ACTIVE — Scheduler for periodic drift detection (ADR-013) */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DriftDetectorService } from '../services/drift-detector.service';
import { SelfHealService } from '../services/self-heal.service';

@Injectable()
export class DriftScheduler {
  private readonly logger = new Logger(DriftScheduler.name);

  constructor(
    private readonly driftDetectorService: DriftDetectorService,
    private readonly selfHealService: SelfHealService,
  ) {}

  /**
   * Every 6 hours — run full drift detection across all strategies.
   * Executes at minute 0 of every 6th hour via CronExpression.EVERY_6_HOURS.
   * If CRITICAL drifts are detected, triggers self-heal to retry failed executions.
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

      // If CRITICAL drifts detected, auto-trigger self-heal
      const critical = events.filter((e) => e.severity === 'CRITICAL');
      if (critical.length > 0) {
        const healResult = await this.selfHealService.retryAllFailed();
        this.logger.log(
          `Drift: ${critical.length} CRITICAL → Self-heal: ${healResult.retried} retried`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Scheduled drift detection failed: ${(error as Error).message}`,
      );
    }
  }
}
