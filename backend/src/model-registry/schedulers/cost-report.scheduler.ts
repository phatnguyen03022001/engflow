/* @lifecycle ACTIVE — Daily cost report scheduler (ADR-010) */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CostTrackerService } from '../services/cost-tracker.service';

@Injectable()
export class CostReportScheduler {
  private readonly logger = new Logger(CostReportScheduler.name);
  private readonly budgetUsd = 80;

  constructor(private readonly costTrackerService: CostTrackerService) {}

  /**
   * Daily at 8:00 AM — generate cost report and check budget.
   */
  @Cron('0 8 * * *')
  async dailyCostReport() {
    this.logger.log('Running daily cost report...');

    try {
      const report = await this.costTrackerService.getCostReport({
        window: 'ROLLING_30D',
      });

      this.logger.log(
        `📊 Cost Report (${report.summary.window}):` +
        ` Total: $${report.summary.totalCostUsd.toFixed(4)}` +
        ` | Requests: ${report.summary.totalRequests}` +
        ` | Avg: $${report.summary.avgCostPerRequest.toFixed(6)}` +
        ` | Projected Monthly: $${report.projection.projectedMonthlyUsd.toFixed(2)}`,
      );

      if (report.projection.projectedMonthlyUsd > this.budgetUsd) {
        this.logger.warn(
          `🚨 Budget alert! Projected monthly spend $${report.projection.projectedMonthlyUsd.toFixed(2)}` +
          ` exceeds budget of $${this.budgetUsd}.00 USD`,
        );
      } else if (report.projection.projectedMonthlyUsd > this.budgetUsd * 0.8) {
        this.logger.warn(
          `⚠️ Budget warning: Projected monthly spend $${report.projection.projectedMonthlyUsd.toFixed(2)}` +
          ` is at ${((report.projection.projectedMonthlyUsd / this.budgetUsd) * 100).toFixed(0)}% of $${this.budgetUsd} budget`,
        );
      } else {
        this.logger.log(
          `✅ Budget OK: projected $${report.projection.projectedMonthlyUsd.toFixed(2)}` +
          ` / $${this.budgetUsd} budget (${((report.projection.projectedMonthlyUsd / this.budgetUsd) * 100).toFixed(0)}%)`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate daily cost report: ${(error as Error).message}`,
      );
    }
  }
}
