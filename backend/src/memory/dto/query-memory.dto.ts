/* @lifecycle ACTIVE — Query similar memories DTO (TASK-029) */

import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AgentType } from '../interfaces/agent-memory.interface';

export class QueryMemoryDto {
  @IsOptional()
  @IsEnum(AgentType)
  agentType?: AgentType;

  @IsOptional()
  @IsString()
  taskType?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  success?: boolean;

  @IsOptional()
  @IsString()
  contextJson?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number;
}
