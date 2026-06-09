/* @lifecycle ACTIVE — DTO for resolving model route (ADR-010) */

import { IsString, IsNotEmpty } from 'class-validator';

export class ModelRouteQueryDto {
  @IsString() @IsNotEmpty()
  agentType: string;

  @IsString() @IsNotEmpty()
  taskType: string;
}
