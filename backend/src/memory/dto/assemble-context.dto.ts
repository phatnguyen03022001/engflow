/* @lifecycle ACTIVE — DTO for context assembly request (ADR-012) */

import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { ContextTier } from '../interfaces/context-manager.interface';

export class AssembleContextDto {
  @IsString()
  @IsNotEmpty()
  agentType: string;

  @IsString()
  @IsNotEmpty()
  taskType: string;

  @IsEnum(ContextTier)
  @IsOptional()
  tier?: ContextTier;

  @IsString()
  @IsOptional()
  sessionId?: string;
}
