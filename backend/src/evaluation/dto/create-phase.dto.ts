// @lifecycle ACTIVE — DTO for recording an execution phase

import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsObject, Min,
} from 'class-validator';

export class CreatePhaseDto {
  @IsString() @IsNotEmpty()
  phaseId: string;

  @IsString() @IsNotEmpty()
  agentType: string;

  @IsInt() @Min(1)
  phaseOrder: number;

  @IsOptional() @IsObject()
  input?: Record<string, unknown>;

  @IsOptional() @IsObject()
  output?: Record<string, unknown>;

  @IsOptional() @IsString()
  decision?: string;

  @IsOptional() @IsString()
  decisionReason?: string;

  @IsOptional() @IsInt() @Min(0)
  durationMs?: number;

  @IsOptional() @IsString()
  modelUsed?: string;

  @IsOptional() @IsString()
  transitionedTo?: string;
}
