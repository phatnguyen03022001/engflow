// @lifecycle ACTIVE — DTO for accuracy query parameters

import { IsOptional, IsString } from 'class-validator';

export class AccuracyQueryDto {
  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  decisionType?: string;
}
