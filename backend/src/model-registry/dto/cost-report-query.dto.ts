/* @lifecycle ACTIVE — DTO for querying cost reports (ADR-010) */

import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class CostReportQueryDto {
  @IsOptional() @IsString()
  window?: string;

  @IsOptional() @IsString()
  from?: string;

  @IsOptional() @IsString()
  to?: string;

  @IsOptional() @IsString()
  modelId?: string;

  @IsOptional() @IsInt() @Min(1)
  limit?: number;
}
