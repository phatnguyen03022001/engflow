/* @lifecycle ACTIVE — Core service for Knowledge Graph CRUD and graph query engine */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, EdgeType } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateNodeDto } from '../dto/create-node.dto';
import { CreateEdgeDto } from '../dto/create-edge.dto';
import { QueryNodesDto, QueryEdgesDto } from '../dto/query-graph.dto';
import {
  KnowledgeNodeFilter,
  KnowledgeEdgeFilter,
  GraphQueryResult,
  PathTraceResult,
  NeighborResult,
} from '../interfaces/knowledge.interface';

@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Node CRUD ───────────────────────────────────────────────────────────

  async createNode(dto: CreateNodeDto) {
    const existing = await this.prisma.knowledgeNode.findUnique({
      where: { nodeId: dto.nodeId },
    });
    if (existing) {
      throw new ConflictException(
        `KnowledgeNode with nodeId "${dto.nodeId}" already exists`,
      );
    }

    return this.prisma.knowledgeNode.create({
      data: {
        nodeId: dto.nodeId,
        type: dto.type,
        label: dto.label,
        description: dto.description ?? null,
        properties: (dto.properties as Prisma.InputJsonValue) ?? undefined,
        sourceFile: dto.sourceFile ?? null,
        module: dto.module ?? null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findNodes(query: QueryNodesDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;

    const where: Prisma.KnowledgeNodeWhereInput = {
      isActive: true,
      ...(query.type && { type: query.type }),
      ...(query.module && { module: query.module }),
      ...(query.search && {
        OR: [
          { label: { contains: query.search, mode: 'insensitive' as Prisma.QueryMode } },
          { description: { contains: query.search, mode: 'insensitive' as Prisma.QueryMode } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.knowledgeNode.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          outgoingEdges: {
            take: 20,
            include: { targetNode: true },
          },
          incomingEdges: {
            take: 20,
            include: { sourceNode: true },
          },
        },
      }),
      this.prisma.knowledgeNode.count({ where }),
    ]);

    return { items, total };
  }

  async findNodeByNodeId(nodeId: string) {
    const node = await this.prisma.knowledgeNode.findUnique({
      where: { nodeId },
      include: {
        outgoingEdges: {
          include: { targetNode: true },
        },
        incomingEdges: {
          include: { sourceNode: true },
        },
      },
    });

    if (!node) {
      throw new NotFoundException(
        `KnowledgeNode with nodeId "${nodeId}" not found`,
      );
    }

    return node;
  }

  async updateNode(nodeId: string, dto: Partial<CreateNodeDto>) {
    const existing = await this.prisma.knowledgeNode.findUnique({
      where: { nodeId },
    });
    if (!existing) {
      throw new NotFoundException(
        `KnowledgeNode with nodeId "${nodeId}" not found`,
      );
    }

    const data: Prisma.KnowledgeNodeUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.properties !== undefined) {
      data.properties = dto.properties as Prisma.InputJsonValue;
    }
    if (dto.sourceFile !== undefined) data.sourceFile = dto.sourceFile;
    if (dto.module !== undefined) data.module = dto.module;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.knowledgeNode.update({
      where: { nodeId },
      data,
    });
  }

  async deactivateNode(nodeId: string) {
    const existing = await this.prisma.knowledgeNode.findUnique({
      where: { nodeId },
    });
    if (!existing) {
      throw new NotFoundException(
        `KnowledgeNode with nodeId "${nodeId}" not found`,
      );
    }

    return this.prisma.knowledgeNode.update({
      where: { nodeId },
      data: { isActive: false },
    });
  }

  // ─── Edge CRUD ───────────────────────────────────────────────────────────

  async createEdge(dto: CreateEdgeDto) {
    // Verify both nodes exist
    const [sourceNode, targetNode] = await Promise.all([
      this.prisma.knowledgeNode.findUnique({ where: { nodeId: dto.sourceNodeId } }),
      this.prisma.knowledgeNode.findUnique({ where: { nodeId: dto.targetNodeId } }),
    ]);

    if (!sourceNode) {
      throw new NotFoundException(
        `Source node with nodeId "${dto.sourceNodeId}" not found`,
      );
    }
    if (!targetNode) {
      throw new NotFoundException(
        `Target node with nodeId "${dto.targetNodeId}" not found`,
      );
    }

    const existing = await this.prisma.knowledgeEdge.findUnique({
      where: { edgeId: dto.edgeId },
    });
    if (existing) {
      throw new ConflictException(
        `KnowledgeEdge with edgeId "${dto.edgeId}" already exists`,
      );
    }

    return this.prisma.knowledgeEdge.create({
      data: {
        edgeId: dto.edgeId,
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        type: dto.type,
        weight: dto.weight ?? 1.0,
        properties: (dto.properties as Prisma.InputJsonValue) ?? undefined,
        description: dto.description ?? null,
      },
    });
  }

  async findEdges(query: QueryEdgesDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;

    const where: Prisma.KnowledgeEdgeWhereInput = {
      ...(query.type && { type: query.type }),
      ...(query.sourceNodeId && {
        sourceNode: { nodeId: query.sourceNodeId },
      }),
      ...(query.targetNodeId && {
        targetNode: { nodeId: query.targetNodeId },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.knowledgeEdge.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          sourceNode: true,
          targetNode: true,
        },
      }),
      this.prisma.knowledgeEdge.count({ where }),
    ]);

    return { items, total };
  }

  async deleteEdge(edgeId: string) {
    const existing = await this.prisma.knowledgeEdge.findUnique({
      where: { edgeId },
    });
    if (!existing) {
      throw new NotFoundException(
        `KnowledgeEdge with edgeId "${edgeId}" not found`,
      );
    }

    return this.prisma.knowledgeEdge.delete({
      where: { edgeId },
    });
  }

  // ─── Graph Query Engine ──────────────────────────────────────────────────

  /**
   * Impact analysis: find all nodes reachable from the given node via outgoing edges.
   * Uses PostgreSQL recursive CTE.
   */
  async queryImpact(nodeId: string, depth: number = 3): Promise<GraphQueryResult> {
    // Resolve internal ID from nodeId
    const node = await this.prisma.knowledgeNode.findUnique({
      where: { nodeId },
    });
    if (!node) {
      throw new NotFoundException(
        `KnowledgeNode with nodeId "${nodeId}" not found`,
      );
    }

    const maxDepth = Math.min(Math.max(depth, 1), 10);

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          node_id: string;
          type: string;
          label: string;
          description: string | null;
          module: string | null;
          depth: number;
        }>
      >(
        `
        WITH RECURSIVE impact AS (
          SELECT e.target_node_id AS node_id, 1 AS depth
          FROM knowledge_edges e
          WHERE e.source_node_id = $1
          UNION ALL
          SELECT e.target_node_id, i.depth + 1
          FROM knowledge_edges e
          INNER JOIN impact i ON e.source_node_id = i.node_id
          WHERE i.depth < $2
        )
        SELECT n.id, n.node_id, n.type, n.label, n.description, n.module, i.depth
        FROM knowledge_nodes n
        INNER JOIN impact i ON n.id = i.node_id
        WHERE n.is_active = true
        ORDER BY i.depth
        `,
        node.id,
        maxDepth,
      );

      return {
        nodes: rows.map((row) => ({
          id: row.id,
          nodeId: row.node_id,
          type: row.type as GraphQueryResult['nodes'][0]['type'],
          label: row.label,
          description: row.description,
          module: row.module,
          depth: Number(row.depth),
        })),
      };
    } catch (error) {
      this.logger.error(`Impact analysis query failed: ${(error as Error).message}`);
      throw new BadRequestException('Graph query execution failed');
    }
  }

  /**
   * Path tracing: find the shortest path between two nodes.
   * Uses PostgreSQL recursive CTE with array-based cycle detection.
   */
  async queryPath(
    fromNodeId: string,
    toNodeId: string,
  ): Promise<PathTraceResult> {
    const [fromNode, toNode] = await Promise.all([
      this.prisma.knowledgeNode.findUnique({ where: { nodeId: fromNodeId } }),
      this.prisma.knowledgeNode.findUnique({ where: { nodeId: toNodeId } }),
    ]);

    if (!fromNode) {
      throw new NotFoundException(
        `Source node with nodeId "${fromNodeId}" not found`,
      );
    }
    if (!toNode) {
      throw new NotFoundException(
        `Target node with nodeId "${toNodeId}" not found`,
      );
    }

    // If same node, return trivial path
    if (fromNode.id === toNode.id) {
      return {
        found: true,
        path: [
          {
            id: fromNode.id,
            nodeId: fromNode.nodeId,
            type: fromNode.type,
            label: fromNode.label,
            depth: 0,
          },
        ],
        totalDepth: 0,
      };
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          node_id: string;
          type: string;
          label: string;
          description: string | null;
          module: string | null;
          depth: number;
        }>
      >(
        `
        WITH RECURSIVE path AS (
          SELECT
            e.source_node_id,
            e.target_node_id,
            1 AS depth,
            ARRAY[e.source_node_id, e.target_node_id] AS path_nodes
          FROM knowledge_edges e
          WHERE e.source_node_id = $1
          UNION ALL
          SELECT
            e.source_node_id,
            e.target_node_id,
            p.depth + 1,
            p.path_nodes || e.target_node_id
          FROM knowledge_edges e
          INNER JOIN path p ON e.source_node_id = p.target_node_id
          WHERE NOT e.target_node_id = ANY(p.path_nodes)
            AND p.depth < 10
        )
        SELECT n.id, n.node_id, n.type, n.label, n.description, n.module, p.depth
        FROM knowledge_nodes n
        INNER JOIN path p ON n.id = p.target_node_id
        WHERE p.target_node_id = $2
        ORDER BY p.depth
        LIMIT 1
        `,
        fromNode.id,
        toNode.id,
      );

      if (rows.length === 0) {
        return { found: false, path: [], totalDepth: 0 };
      }

      // We also need to include the start node
      const pathNodes = [
        {
          id: fromNode.id,
          nodeId: fromNode.nodeId,
          type: fromNode.type,
          label: fromNode.label,
          depth: 0,
        },
        ...rows.map((row) => ({
          id: row.id,
          nodeId: row.node_id,
          type: row.type as PathTraceResult['path'][0]['type'],
          label: row.label,
          depth: Number(row.depth),
        })),
      ];

      return {
        found: true,
        path: pathNodes,
        totalDepth: pathNodes.length - 1,
      };
    } catch (error) {
      this.logger.error(`Path tracing query failed: ${(error as Error).message}`);
      throw new BadRequestException('Graph query execution failed');
    }
  }

  /**
   * Neighbor query: get all direct incoming and outgoing edges for a node.
   */
  async queryNeighbors(
    nodeId: string,
    edgeType?: string,
  ): Promise<NeighborResult> {
    const node = await this.prisma.knowledgeNode.findUnique({
      where: { nodeId },
    });
    if (!node) {
      throw new NotFoundException(
        `KnowledgeNode with nodeId "${nodeId}" not found`,
      );
    }

    const edgeFilter: Prisma.KnowledgeEdgeWhereInput = {};
    if (edgeType) {
      edgeFilter.type = edgeType as unknown as EdgeType;
    }

    const [outgoing, incoming] = await Promise.all([
      this.prisma.knowledgeEdge.findMany({
        where: { sourceNodeId: node.id, ...edgeFilter },
        include: { targetNode: true },
      }),
      this.prisma.knowledgeEdge.findMany({
        where: { targetNodeId: node.id, ...edgeFilter },
        include: { sourceNode: true },
      }),
    ]);

    return {
      outgoing: outgoing.map((e) => ({
        edge: {
          id: e.id,
          edgeId: e.edgeId,
          type: e.type,
          weight: e.weight,
          description: e.description,
        },
        node: {
          id: e.targetNode.id,
          nodeId: e.targetNode.nodeId,
          type: e.targetNode.type,
          label: e.targetNode.label,
        },
      })),
      incoming: incoming.map((e) => ({
        edge: {
          id: e.id,
          edgeId: e.edgeId,
          type: e.type,
          weight: e.weight,
          description: e.description,
        },
        node: {
          id: e.sourceNode.id,
          nodeId: e.sourceNode.nodeId,
          type: e.sourceNode.type,
          label: e.sourceNode.label,
        },
      })),
    };
  }

  /**
   * Filter query: list nodes with optional type, module, and search filters.
   */
  async queryNodes(filter: KnowledgeNodeFilter) {
    const where: Prisma.KnowledgeNodeWhereInput = {
      isActive: filter.isActive ?? true,
      ...(filter.type && { type: filter.type }),
      ...(filter.module && { module: filter.module }),
      ...(filter.search && {
        OR: [
          { label: { contains: filter.search, mode: 'insensitive' as Prisma.QueryMode } },
          { description: { contains: filter.search, mode: 'insensitive' as Prisma.QueryMode } },
        ],
      }),
    };

    return this.prisma.knowledgeNode.findMany({
      where,
      include: {
        outgoingEdges: { take: 20, include: { targetNode: true } },
        incomingEdges: { take: 20, include: { sourceNode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
