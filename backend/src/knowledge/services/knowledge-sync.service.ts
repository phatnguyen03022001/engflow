/* @lifecycle ACTIVE — Service for scanning and seeding knowledge graph nodes */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeType, EdgeType } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SyncResult } from '../interfaces/knowledge.interface';
import { CreateNodeDto } from '../dto/create-node.dto';
import { CreateEdgeDto } from '../dto/create-edge.dto';

@Injectable()
export class KnowledgeSyncService {
  private readonly logger = new Logger(KnowledgeSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async syncFromFileScan(): Promise<SyncResult> {
    this.logger.log('Starting knowledge graph sync from file scan...');
    const result: SyncResult = { nodesCreated: 0, edgesCreated: 0, errors: [] };

    try {
      // Phase 1 (MVP): seed starter nodes and edges
      await this.seedStarterData(result);
    } catch (error) {
      this.logger.error(`Sync failed: ${(error as Error).message}`);
      result.errors.push((error as Error).message);
    }

    this.logger.log(
      `Sync complete: ${result.nodesCreated} nodes, ${result.edgesCreated} edges created`,
    );
    return result;
  }

  private async seedStarterData(result: SyncResult): Promise<void> {
    const starterNodes: CreateNodeDto[] = [
      {
        nodeId: 'sys-overview',
        type: NodeType.ARCHITECTURE,
        label: 'System Overview',
        description: 'Floweng — Modular Monolith English Learning Platform',
        module: 'core',
      },
      {
        nodeId: 'arch-modular-monolith',
        type: NodeType.ARCHITECTURE,
        label: 'Modular Monolith Pattern',
        description: 'Single deployable unit with modular code organization',
        module: 'core',
      },
      {
        nodeId: 'adr-001',
        type: NodeType.DECISION,
        label: 'ADR-001: Reuse-First Governance',
        description: 'Reuse-first governance model for the AI Software Factory',
        sourceFile: 'docs/decisions/001-reuse-first-governance.md',
      },
      {
        nodeId: 'adr-002',
        type: NodeType.DECISION,
        label: 'ADR-002: Recommendation Registry',
        description: 'Structured recommendation format with confidence scoring',
        sourceFile: 'docs/decisions/002-recommendation-registry.md',
      },
      {
        nodeId: 'adr-003',
        type: NodeType.DECISION,
        label: 'ADR-003: Agent Evaluation Harness',
        description: 'Execution trace and metric collection for agent evaluation',
        sourceFile: 'docs/decisions/003-agent-evaluation-harness.md',
      },
      {
        nodeId: 'adr-008',
        type: NodeType.DECISION,
        label: 'ADR-008: Lifecycle Declarations',
        description: 'Lifecycle metadata on every source file',
        sourceFile: 'docs/decisions/008-lifecycle-declarations.md',
      },
      {
        nodeId: 'adr-009',
        type: NodeType.DECISION,
        label: 'ADR-009: UUID v7',
        description: 'UUID v7 for all primary keys',
        sourceFile: 'docs/decisions/009-uuid7.md',
      },
      {
        nodeId: 'adr-010',
        type: NodeType.DECISION,
        label: 'ADR-010: Model Registry',
        description: 'Model registry for AI model management',
        sourceFile: 'docs/decisions/010-model-registry.md',
      },
      {
        nodeId: 'adr-011',
        type: NodeType.DECISION,
        label: 'ADR-011: Knowledge Graph',
        description: 'Cross-layer traceability via Knowledge Graph',
        sourceFile: 'docs/decisions/011-knowledge-graph.md',
      },
      {
        nodeId: 'mod-auth',
        type: NodeType.CODE,
        label: 'Auth Module',
        description: 'Authentication and authorization module',
        module: 'auth',
        sourceFile: 'backend/src/auth/',
      },
      {
        nodeId: 'mod-user',
        type: NodeType.CODE,
        label: 'User Module',
        description: 'User management module',
        module: 'user',
        sourceFile: 'backend/src/user/',
      },
      {
        nodeId: 'mod-learning',
        type: NodeType.CODE,
        label: 'Learning Module',
        description: 'Learning content module (lessons, exercises)',
        module: 'learning',
        sourceFile: 'backend/src/learning/',
      },
      {
        nodeId: 'mod-recommendation',
        type: NodeType.CODE,
        label: 'Recommendation Module',
        description: 'Recommendation registry module',
        module: 'recommendation',
        sourceFile: 'backend/src/recommendation/',
      },
      {
        nodeId: 'mod-evaluation',
        type: NodeType.CODE,
        label: 'Evaluation Module',
        description: 'Agent evaluation harness module',
        module: 'evaluation',
        sourceFile: 'backend/src/evaluation/',
      },
      {
        nodeId: 'mod-memory',
        type: NodeType.CODE,
        label: 'Memory Module',
        description: 'Agent memory and context retrieval module',
        module: 'memory',
        sourceFile: 'backend/src/memory/',
      },
      {
        nodeId: 'mod-model-registry',
        type: NodeType.CODE,
        label: 'Model Registry Module',
        description: 'Model intelligence module',
        module: 'model-registry',
        sourceFile: 'backend/src/model-registry/',
      },
    ];

    const starterEdges: CreateEdgeDto[] = [
      {
        edgeId: 'e-001',
        sourceNodeId: 'sys-overview',
        targetNodeId: 'arch-modular-monolith',
        type: EdgeType.REFERENCES,
        description: 'System overview references monolith pattern',
      },
      {
        edgeId: 'e-002',
        sourceNodeId: 'sys-overview',
        targetNodeId: 'adr-011',
        type: EdgeType.REFERENCES,
        description: 'System overview references knowledge graph ADR',
      },
      {
        edgeId: 'e-003',
        sourceNodeId: 'adr-001',
        targetNodeId: 'mod-auth',
        type: EdgeType.DECIDES,
        description: 'Reuse-first governance applies to auth module',
      },
      {
        edgeId: 'e-004',
        sourceNodeId: 'adr-001',
        targetNodeId: 'mod-user',
        type: EdgeType.DECIDES,
        description: 'Reuse-first governance applies to user module',
      },
      {
        edgeId: 'e-005',
        sourceNodeId: 'adr-001',
        targetNodeId: 'mod-learning',
        type: EdgeType.DECIDES,
        description: 'Reuse-first governance applies to learning module',
      },
      {
        edgeId: 'e-006',
        sourceNodeId: 'adr-002',
        targetNodeId: 'mod-recommendation',
        type: EdgeType.DECIDES,
        description: 'Recommendation registry ADR implements recommendation module',
      },
      {
        edgeId: 'e-007',
        sourceNodeId: 'adr-003',
        targetNodeId: 'mod-evaluation',
        type: EdgeType.DECIDES,
        description: 'Evaluation harness ADR implements evaluation module',
      },
      {
        edgeId: 'e-008',
        sourceNodeId: 'adr-008',
        targetNodeId: 'adr-011',
        type: EdgeType.REFERENCES,
        description: 'Lifecycle declarations referenced by knowledge graph ADR',
      },
      {
        edgeId: 'e-009',
        sourceNodeId: 'adr-010',
        targetNodeId: 'mod-model-registry',
        type: EdgeType.DECIDES,
        description: 'Model registry ADR implements model-registry module',
      },
      {
        edgeId: 'e-010',
        sourceNodeId: 'mod-evaluation',
        targetNodeId: 'mod-recommendation',
        type: EdgeType.DEPENDS_ON,
        description: 'Evaluation module depends on recommendation module',
      },
      {
        edgeId: 'e-011',
        sourceNodeId: 'mod-memory',
        targetNodeId: 'mod-recommendation',
        type: EdgeType.DEPENDS_ON,
        description: 'Memory module depends on recommendation module',
      },
      {
        edgeId: 'e-012',
        sourceNodeId: 'adr-009',
        targetNodeId: 'adr-011',
        type: EdgeType.REFERENCES,
        description: 'UUID v7 referenced by knowledge graph ADR',
      },
    ];

    for (const node of starterNodes) {
      try {
        await this.prisma.knowledgeNode.create({
          data: {
            nodeId: node.nodeId,
            type: node.type as NodeType,
            label: node.label,
            description: node.description ?? null,
            sourceFile: node.sourceFile ?? null,
            module: node.module ?? null,
          },
        });
        result.nodesCreated++;
      } catch (err) {
        // Skip if node already exists (idempotent sync)
        if ((err as any)?.code !== 'P2002') {
          result.errors.push(
            `Failed to create node "${node.nodeId}": ${(err as Error).message}`,
          );
        }
      }
    }

    // Create edges: need to resolve Prisma IDs from nodeIds
    const allNodes = await this.prisma.knowledgeNode.findMany({
      select: { id: true, nodeId: true },
    });
    const nodeIdToPrismaId = new Map(allNodes.map((n) => [n.nodeId, n.id]));

    for (const edge of starterEdges) {
      const sourcePrismaId = nodeIdToPrismaId.get(edge.sourceNodeId);
      const targetPrismaId = nodeIdToPrismaId.get(edge.targetNodeId);

      if (!sourcePrismaId || !targetPrismaId) {
        result.errors.push(
          `Cannot create edge "${edge.edgeId}": source or target node not resolved`,
        );
        continue;
      }

      try {
        await this.prisma.knowledgeEdge.create({
          data: {
            edgeId: edge.edgeId,
            sourceNodeId: sourcePrismaId,
            targetNodeId: targetPrismaId,
            type: edge.type as EdgeType,
            weight: edge.weight ?? 1.0,
            description: edge.description ?? null,
          },
        });
        result.edgesCreated++;
      } catch (err) {
        if ((err as any)?.code !== 'P2002') {
          result.errors.push(
            `Failed to create edge "${edge.edgeId}": ${(err as Error).message}`,
          );
        }
      }
    }
  }
}
