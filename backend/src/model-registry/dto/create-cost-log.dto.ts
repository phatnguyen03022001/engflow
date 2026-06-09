/* @lifecycle ACTIVE — DTO for recording a cost log entry (ADR-010) */

import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsNumber, Min,
} from 'class-validator';

export class CreateCostLogDto {
  @IsString() @IsNotEmpty()
  modelId: string;

  @IsString() @IsNotEmpty()
  executionId: string;

  @IsOptional() @IsString()
  phaseId?: string;

  @IsInt() @Min(0)
  inputTokens: number;

  @IsInt() @Min(0)
  outputTokens: number;

  @IsNumber() @Min(0)
  costUsd: number;

  @IsInt() @Min(0)
  latencyMs: number;

  @IsOptional() @IsBoolean()
  wasFallback?: boolean;

  @IsOptional() @IsString()
  fallbackFrom?: string;
}
