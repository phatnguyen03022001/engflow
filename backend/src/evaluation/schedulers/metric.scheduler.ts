// @lifecycle ACTIVE — Scheduler for periodic metric computation

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricService } from '../services/metric.service';

@Injectable()
export class MetricScheduler {
  private readonly logger = new Logger(MetricScheduler.name);

  constructor(private readonly metricService: MetricService) {}

  /**
   * Daily at 02:00 — compute ROLLING_30D, ROLLING_7D, DAILY windows.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async dailyMetricComputation() {
    this.logger.log('Running daily metric computation...');

    const windows = ['ROLLING_30D', 'ROLLING_7D', 'DAILY'];

    for (const window of windows) {
      try {
        const snapshots = await this.metricService.computeAll(window);
        this.logger.log(
          `Computed ${snapshots.length} metrics for window=${window}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to compute metrics for window=${window}: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Weekly on Monday at 03:00 — recompute ALL_TIME metrics.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async weeklyAllTimeRecompute() {
    this.logger.log('Running weekly ALL_TIME metric recomputation...');

    try {
      const snapshots = await this.metricService.recomputeAll('ALL_TIME');
      this.logger.log(
        `Recomputed ${snapshots.length} ALL_TIME metrics`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to recompute ALL_TIME metrics: ${(error as Error).message}`,
      );
    }
  }
}
