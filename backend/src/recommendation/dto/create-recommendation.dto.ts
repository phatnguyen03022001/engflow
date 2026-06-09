// @lifecycle ACTIVE — DTO for creating a recommendation

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  IsInt,
  IsEnum,
  Min,
  Max,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  RecommendationMode,
  DecisionType,
  ConfidenceLevel,
} from '../interfaces/recommendation.interface';

class OptionDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  @Max(5)
  score: number;
}

class RiskDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  severity: string;
}

export class CreateRecommendationDto {
  @IsString()
  @IsNotEmpty()
  recId: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(RecommendationMode)
  mode: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(DecisionType)
  decisionType: string;

  @IsString()
  @IsNotEmpty()
  decisionDomain: string;

  @IsString()
  @IsNotEmpty()
  querySummary: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  constraints?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourcesConsulted?: string[];

  @IsOptional()
  @IsString()
  architectureVersion?: string;

  @IsOptional()
  @IsString()
  constitutionVersion?: string;

  // Winner fields
  @IsString()
  @IsNotEmpty()
  recommendedOption: string;

  @IsString()
  @IsNotEmpty()
  justification: string;

  // Confidence
  @IsString()
  @IsNotEmpty()
  @IsEnum(ConfidenceLevel)
  confidenceLevel: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  unknownsCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  unknownsCritical?: number;

  // Forecast
  @IsOptional()
  @IsString()
  expectedOutcome?: string;

  @IsOptional()
  @IsString()
  debtForecast?: string;

  @IsOptional()
  @IsString()
  timelineToValue?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisites?: string[];

  @IsOptional()
  @IsString()
  whenToRevisit?: string;

  // Options
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options?: OptionDto[];

  // Success criteria
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  successCriteria?: string[];

  // Risks
  @IsOptional()
  @IsObject()
  predictedRisks?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  riskMitigations?: string[];

  // Metadata
  @IsOptional()
  @IsString()
  reasoningTrace?: string;

  @IsOptional()
  @IsString()
  advisoryReportRef?: string;

  @IsOptional()
  @IsString()
  modelVersion?: string;

  @IsOptional()
  @IsObject()
  escalationHistory?: Record<string, unknown>;
}
