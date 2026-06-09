/* @lifecycle ACTIVE — DTO for registering a model in the registry (ADR-010) */

import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsNumber,
  IsArray, IsEnum, IsBoolean, Min, Max,
} from 'class-validator';
import { ModelTier, ModelCapability } from '../interfaces/model-registry.interface';

export class CreateModelDto {
  @IsString() @IsNotEmpty()
  modelId: string;

  @IsString() @IsNotEmpty()
  providerId: string;

  @IsString() @IsNotEmpty()
  displayName: string;

  @IsOptional() @IsEnum(ModelTier)
  tier?: ModelTier;

  @IsOptional() @IsArray()
  @IsEnum(ModelCapability, { each: true })
  capabilities?: ModelCapability[];

  @IsInt() @Min(1)
  contextWindow: number;

  @IsOptional() @IsInt() @Min(1)
  maxOutputTokens?: number;

  @IsNumber() @Min(0)
  costPer1kInput: number;

  @IsNumber() @Min(0)
  costPer1kOutput: number;

  @IsOptional() @IsInt() @Min(0)
  avgLatencyMs?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(1)
  successRate?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(1)
  qualityScore?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsString()
  replacedByModelId?: string;
}
