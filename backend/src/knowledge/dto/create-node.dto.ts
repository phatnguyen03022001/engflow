/* @lifecycle ACTIVE — DTO for creating a knowledge node */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { NodeType } from '@prisma/client';

export class CreateNodeDto {
  @IsString() @IsNotEmpty()
  nodeId: string;

  @IsEnum(NodeType)
  type: NodeType;

  @IsString() @IsNotEmpty()
  label: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsObject()
  properties?: Record<string, unknown>;

  @IsOptional() @IsString()
  sourceFile?: string;

  @IsOptional() @IsString()
  module?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
