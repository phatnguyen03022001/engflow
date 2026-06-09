/* @lifecycle ACTIVE — Response DTOs for knowledge graph endpoints */

import { NodeType, EdgeType } from '@prisma/client';

export class KnowledgeNodeResponseDto {
  id: string;
  nodeId: string;
  type: NodeType;
  label: string;
  description: string | null;
  properties: Record<string, unknown> | null;
  sourceFile: string | null;
  module: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class KnowledgeEdgeResponseDto {
  id: string;
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  weight: number;
  properties: Record<string, unknown> | null;
  description: string | null;
  createdAt: Date;
}
