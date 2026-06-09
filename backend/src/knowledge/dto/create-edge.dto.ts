/* @lifecycle ACTIVE — DTO for creating a knowledge edge */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { EdgeType } from '@prisma/client';

export class CreateEdgeDto {
  @IsString() @IsNotEmpty()
  edgeId: string;

  @IsString() @IsNotEmpty()
  sourceNodeId: string;

  @IsString() @IsNotEmpty()
  targetNodeId: string;

  @IsEnum(EdgeType)
  type: EdgeType;

  @IsOptional() @IsNumber() @Min(0) @Max(1)
  weight?: number;

  @IsOptional() @IsObject()
  properties?: Record<string, unknown>;

  @IsOptional() @IsString()
  description?: string;
}
