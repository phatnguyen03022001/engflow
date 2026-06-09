/* @lifecycle ACTIVE — DTO for creating a model routing rule (ADR-010) */

import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsNumber, IsBoolean, Min,
} from 'class-validator';

export class CreateRouteDto {
  @IsString() @IsNotEmpty()
  routeId: string;

  @IsString() @IsNotEmpty()
  agentType: string;

  @IsString() @IsNotEmpty()
  taskType: string;

  @IsString() @IsNotEmpty()
  primaryModelId: string;

  @IsOptional() @IsInt() @Min(0)
  priority?: number;

  @IsOptional() @IsNumber() @Min(0)
  maxCostUsd?: number;

  @IsOptional() @IsInt() @Min(0)
  maxLatencyMs?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
