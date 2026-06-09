// @lifecycle ACTIVE — DTO for querying agent metrics

import { IsOptional, IsString } from 'class-validator';

export class QueryMetricsDto {
  @IsOptional() @IsString()
  agentType?: string;

  @IsOptional() @IsString()
  metricName?: string;

  @IsOptional() @IsString()
  window?: string;

  @IsOptional() @IsString()
  skip?: string;

  @IsOptional() @IsString()
  take?: string;
}
