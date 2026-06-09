/* @lifecycle ACTIVE — DTOs for knowledge graph queries */

import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { NodeType, EdgeType } from '@prisma/client';

export class QueryNodesDto {
  @IsOptional() @IsEnum(NodeType)
  type?: NodeType;

  @IsOptional() @IsString()
  module?: string;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  skip?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  take?: number;
}

export class QueryEdgesDto {
  @IsOptional() @IsEnum(EdgeType)
  type?: EdgeType;

  @IsOptional() @IsString()
  sourceNodeId?: string;

  @IsOptional() @IsString()
  targetNodeId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  skip?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  take?: number;
}

export class ImpactQueryDto {
  @IsString()
  nodeId: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10)
  depth?: number;
}

export class PathTraceQueryDto {
  @IsString()
  fromNodeId: string;

  @IsString()
  toNodeId: string;
}

export class NeighborQueryDto {
  @IsString()
  nodeId: string;

  @IsOptional() @IsEnum(EdgeType)
  edgeType?: EdgeType;
}
