/* @lifecycle ACTIVE — Model intelligence module (ADR-010) */

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ModelRegistryController } from './model-registry.controller';
import { RegistryService } from './services/registry.service';
import { RouterService } from './services/router.service';
import { CostTrackerService } from './services/cost-tracker.service';
import { FallbackService } from './services/fallback.service';
import { CostReportScheduler } from './schedulers/cost-report.scheduler';

@Module({
  imports: [ScheduleModule],
  controllers: [ModelRegistryController],
  providers: [
    RegistryService,
    RouterService,
    CostTrackerService,
    FallbackService,
    CostReportScheduler,
  ],
  exports: [RouterService, CostTrackerService],
})
export class ModelRegistryModule {}
