/* @lifecycle ACTIVE — TypeScript interfaces for Knowledge Graph module */

import { NodeType, EdgeType } from '@prisma/client';

export interface KnowledgeNodeFilter {
  type?: NodeType;
  module?: string;
  search?: string;
  isActive?: boolean;
}

export interface KnowledgeEdgeFilter {
  type?: EdgeType;
  sourceNodeId?: string;
  targetNodeId?: string;
}

export interface GraphQueryResult {
  nodes: Array<{
    id: string;
    nodeId: string;
    type: NodeType;
    label: string;
    description: string | null;
    module: string | null;
    depth: number;
  }>;
}

export interface PathTraceResult {
  found: boolean;
  path: Array<{
    id: string;
    nodeId: string;
    type: NodeType;
    label: string;
    depth: number;
  }>;
  totalDepth: number;
}

export interface NeighborResult {
  outgoing: Array<{
    edge: {
      id: string;
      edgeId: string;
      type: EdgeType;
      weight: number;
      description: string | null;
    };
    node: {
      id: string;
      nodeId: string;
      type: NodeType;
      label: string;
    };
  }>;
  incoming: Array<{
    edge: {
      id: string;
      edgeId: string;
      type: EdgeType;
      weight: number;
      description: string | null;
    };
    node: {
      id: string;
      nodeId: string;
      type: NodeType;
      label: string;
    };
  }>;
}

export interface SyncResult {
  nodesCreated: number;
  edgesCreated: number;
  errors: string[];
}
