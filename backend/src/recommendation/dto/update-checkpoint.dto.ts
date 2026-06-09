// @lifecycle ACTIVE — DTO for creating/updating a checkpoint assessment

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsEnum,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import {
  CheckpointPeriod,
  CheckpointVerdict,
  ImplementationFaith,
  PerformanceImpact,
  TeamSatisfaction,
  VerdictConfidence,
} from '../interfaces/recommendation.interface';

export class UpdateCheckpointDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(CheckpointPeriod)
  checkpoint: string;

  @IsOptional()
  @IsString()
  evaluator?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceSources?: string[];

  @IsOptional()
  @IsBoolean()
  wasImplemented?: boolean;

  @IsOptional()
  @IsString()
  implementedOption?: string;

  @IsOptional()
  @IsString()
  @IsEnum(ImplementationFaith)
  implementationFaith?: string;

  @IsOptional()
  @IsString()
  divergenceReason?: string;

  @IsOptional()
  @IsBoolean()
  problemSolved?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  solutionScore?: number;

  @IsOptional()
  @IsString()
  debtIntroduced?: string;

  @IsOptional()
  @IsString()
  @IsEnum(PerformanceImpact)
  performanceImpact?: string;

  @IsOptional()
  @IsString()
  @IsEnum(TeamSatisfaction)
  teamSatisfaction?: string;

  // These fields are JSONB in the database and accept any valid JSON (object or array).
  // Validation is intentionally loose since Prisma casts to InputJsonValue.
  @IsOptional()
  risksMaterialized?: Record<string, unknown> | unknown[];

  @IsOptional()
  risksAvoided?: Record<string, unknown> | unknown[];

  @IsOptional()
  missedRisks?: Record<string, unknown> | unknown[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  riskAssessmentAcc?: number;

  @IsOptional()
  @IsBoolean()
  forecastAccurate?: boolean;

  @IsOptional()
  @IsString()
  forecastDeviation?: string;

  @IsOptional()
  @IsBoolean()
  timelineAccurate?: boolean;

  @IsOptional()
  @IsBoolean()
  wasReplaced?: boolean;

  @IsOptional()
  @IsString()
  replacementReason?: string;

  @IsOptional()
  @IsBoolean()
  wasReversedByAdr?: boolean;

  @IsOptional()
  @IsString()
  @IsEnum(CheckpointVerdict)
  checkpointVerdict?: string;

  @IsOptional()
  @IsString()
  @IsEnum(VerdictConfidence)
  verdictConfidence?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
