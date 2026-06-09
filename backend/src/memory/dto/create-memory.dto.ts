/* @lifecycle ACTIVE — Create memory DTO (TASK-029) */

import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  IsObject,
} from 'class-validator';
import { AgentType, MemoryOutcome } from '../interfaces/agent-memory.interface';

export class CreateMemoryDto {
  @IsEnum(AgentType)
  agentType: AgentType;

  @IsString()
  @IsNotEmpty()
  taskType: string;

  @IsEnum(MemoryOutcome)
  outcome: MemoryOutcome;

  @IsBoolean()
  success: boolean;

  @IsOptional()
  @IsString()
  decision?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lessonsLearned?: string[];

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  technology?: string;

  @IsOptional()
  @IsString()
  sourceExecutionId?: string;

  @IsOptional()
  @IsString()
  sourcePhaseId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}
