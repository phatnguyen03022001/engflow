/* @lifecycle ACTIVE — Unit tests for KnowledgeGraphService */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NodeType, EdgeType } from '@prisma/client';
import { KnowledgeGraphService } from '../services/knowledge-graph.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    knowledgeNode: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    knowledgeEdge: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  };

  const mockNode = {
    id: 'node-internal-1',
    nodeId: 'test-node',
    type: NodeType.ARCHITECTURE,
    label: 'Test Node',
    description: 'A test node',
    properties: null,
    sourceFile: null,
    module: 'test',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNode2 = {
    id: 'node-internal-2',
    nodeId: 'test-node-2',
    type: NodeType.CODE,
    label: 'Test Node 2',
    description: null,
    properties: null,
    sourceFile: 'src/test.ts',
    module: 'test',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEdge = {
    id: 'edge-internal-1',
    edgeId: 'test-edge',
    sourceNodeId: 'node-internal-1',
    targetNodeId: 'node-internal-2',
    type: EdgeType.DEPENDS_ON,
    weight: 1.0,
    properties: null,
    description: 'Test edge',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeGraphService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<KnowledgeGraphService>(KnowledgeGraphService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Node CRUD ───────────────────────────────────────────────────────────

  describe('createNode', () => {
    const createNodeDto = {
      nodeId: 'test-node',
      type: NodeType.ARCHITECTURE,
      label: 'Test Node',
      description: 'A test node',
      module: 'test',
    };

    it('should create a node successfully', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);
      mockPrisma.knowledgeNode.create.mockResolvedValue(mockNode);

      const result = await service.createNode(createNodeDto);

      expect(mockPrisma.knowledgeNode.findUnique).toHaveBeenCalledWith({
        where: { nodeId: 'test-node' },
      });
      expect(mockPrisma.knowledgeNode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nodeId: 'test-node',
          type: NodeType.ARCHITECTURE,
          label: 'Test Node',
          isActive: true,
        }),
      });
      expect(result).toEqual(mockNode);
    });

    it('should throw ConflictException for duplicate nodeId', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(mockNode);

      await expect(service.createNode(createNodeDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.knowledgeNode.create).not.toHaveBeenCalled();
    });

    it('should create node with all optional fields', async () => {
      const fullDto = {
        nodeId: 'full-node',
        type: NodeType.DECISION,
        label: 'Full Node',
        description: 'With all fields',
        properties: { key: 'value' },
        sourceFile: 'docs/test.md',
        module: 'core',
        isActive: false,
      };

      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);
      mockPrisma.knowledgeNode.create.mockResolvedValue({
        ...mockNode,
        nodeId: 'full-node',
        type: NodeType.DECISION,
      });

      await service.createNode(fullDto);

      expect(mockPrisma.knowledgeNode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nodeId: 'full-node',
          type: NodeType.DECISION,
          sourceFile: 'docs/test.md',
          isActive: false,
        }),
      });
    });
  });

  describe('findNodes', () => {
    it('should return paginated results without filters', async () => {
      mockPrisma.knowledgeNode.findMany.mockResolvedValue([mockNode]);
      mockPrisma.knowledgeNode.count.mockResolvedValue(1);

      const result = await service.findNodes({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.knowledgeNode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('should apply type filter', async () => {
      mockPrisma.knowledgeNode.findMany.mockResolvedValue([]);
      mockPrisma.knowledgeNode.count.mockResolvedValue(0);

      await service.findNodes({ type: NodeType.CODE });

      expect(mockPrisma.knowledgeNode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: NodeType.CODE }),
        }),
      );
    });

    it('should apply module filter', async () => {
      mockPrisma.knowledgeNode.findMany.mockResolvedValue([]);
      mockPrisma.knowledgeNode.count.mockResolvedValue(0);

      await service.findNodes({ module: 'auth' });

      expect(mockPrisma.knowledgeNode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ module: 'auth' }),
        }),
      );
    });

    it('should apply search filter', async () => {
      mockPrisma.knowledgeNode.findMany.mockResolvedValue([]);
      mockPrisma.knowledgeNode.count.mockResolvedValue(0);

      await service.findNodes({ search: 'test' });

      expect(mockPrisma.knowledgeNode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                label: { contains: 'test', mode: 'insensitive' },
              }),
            ]),
          }),
        }),
      );
    });

    it('should return empty results', async () => {
      mockPrisma.knowledgeNode.findMany.mockResolvedValue([]);
      mockPrisma.knowledgeNode.count.mockResolvedValue(0);

      const result = await service.findNodes({});

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findNodeByNodeId', () => {
    it('should return a node by nodeId', async () => {
      const nodeWithEdges = {
        ...mockNode,
        outgoingEdges: [],
        incomingEdges: [],
      };
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(nodeWithEdges);

      const result = await service.findNodeByNodeId('test-node');

      expect(result).toEqual(nodeWithEdges);
      expect(mockPrisma.knowledgeNode.findUnique).toHaveBeenCalledWith({
        where: { nodeId: 'test-node' },
        include: {
          outgoingEdges: { include: { targetNode: true } },
          incomingEdges: { include: { sourceNode: true } },
        },
      });
    });

    it('should throw NotFoundException when node not found', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);

      await expect(
        service.findNodeByNodeId('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateNode', () => {
    it('should update a node', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(mockNode);
      mockPrisma.knowledgeNode.update.mockResolvedValue({
        ...mockNode,
        label: 'Updated Label',
      });

      const result = await service.updateNode('test-node', {
        label: 'Updated Label',
      });

      expect(mockPrisma.knowledgeNode.update).toHaveBeenCalledWith({
        where: { nodeId: 'test-node' },
        data: { label: 'Updated Label' },
      });
      expect(result.label).toBe('Updated Label');
    });

    it('should throw NotFoundException when updating nonexistent', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);

      await expect(
        service.updateNode('nonexistent', { label: 'New' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.knowledgeNode.update).not.toHaveBeenCalled();
    });

    it('should handle partial update', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(mockNode);
      mockPrisma.knowledgeNode.update.mockResolvedValue(mockNode);

      await service.updateNode('test-node', { description: 'Updated desc' });

      expect(mockPrisma.knowledgeNode.update).toHaveBeenCalledWith({
        where: { nodeId: 'test-node' },
        data: { description: 'Updated desc' },
      });
    });
  });

  describe('deactivateNode', () => {
    it('should soft-deactivate a node', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(mockNode);
      mockPrisma.knowledgeNode.update.mockResolvedValue({
        ...mockNode,
        isActive: false,
      });

      const result = await service.deactivateNode('test-node');

      expect(mockPrisma.knowledgeNode.update).toHaveBeenCalledWith({
        where: { nodeId: 'test-node' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException when deactivating nonexistent', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);

      await expect(service.deactivateNode('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Edge CRUD ───────────────────────────────────────────────────────────

  describe('createEdge', () => {
    const createEdgeDto = {
      edgeId: 'test-edge',
      sourceNodeId: 'test-node',
      targetNodeId: 'test-node-2',
      type: EdgeType.DEPENDS_ON,
      description: 'Test edge',
    };

    it('should create an edge successfully', async () => {
      mockPrisma.knowledgeNode.findUnique
        .mockResolvedValueOnce(mockNode) // source
        .mockResolvedValueOnce(mockNode2); // target
      mockPrisma.knowledgeEdge.findUnique.mockResolvedValue(null);
      mockPrisma.knowledgeEdge.create.mockResolvedValue(mockEdge);

      const result = await service.createEdge(createEdgeDto);

      expect(mockPrisma.knowledgeEdge.create).toHaveBeenCalled();
      expect(result).toEqual(mockEdge);
    });

    it('should throw NotFoundException when source node not found', async () => {
      mockPrisma.knowledgeNode.findUnique
        .mockResolvedValueOnce(null) // source not found
        .mockResolvedValueOnce(mockNode2);

      await expect(service.createEdge(createEdgeDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.knowledgeEdge.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when target node not found', async () => {
      mockPrisma.knowledgeNode.findUnique
        .mockResolvedValueOnce(mockNode)
        .mockResolvedValueOnce(null); // target not found

      await expect(service.createEdge(createEdgeDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException for duplicate edgeId', async () => {
      mockPrisma.knowledgeNode.findUnique
        .mockResolvedValueOnce(mockNode)
        .mockResolvedValueOnce(mockNode2);
      mockPrisma.knowledgeEdge.findUnique.mockResolvedValue(mockEdge);

      await expect(service.createEdge(createEdgeDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.knowledgeEdge.create).not.toHaveBeenCalled();
    });
  });

  describe('findEdges', () => {
    it('should return paginated edges', async () => {
      const edgeWithNodes = {
        ...mockEdge,
        sourceNode: mockNode,
        targetNode: mockNode2,
      };
      mockPrisma.knowledgeEdge.findMany.mockResolvedValue([edgeWithNodes]);
      mockPrisma.knowledgeEdge.count.mockResolvedValue(1);

      const result = await service.findEdges({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply type filter', async () => {
      mockPrisma.knowledgeEdge.findMany.mockResolvedValue([]);
      mockPrisma.knowledgeEdge.count.mockResolvedValue(0);

      await service.findEdges({ type: EdgeType.DEPENDS_ON });

      expect(mockPrisma.knowledgeEdge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: EdgeType.DEPENDS_ON }),
        }),
      );
    });
  });

  describe('deleteEdge', () => {
    it('should delete an edge', async () => {
      mockPrisma.knowledgeEdge.findUnique.mockResolvedValue(mockEdge);
      mockPrisma.knowledgeEdge.delete.mockResolvedValue(mockEdge);

      const result = await service.deleteEdge('test-edge');

      expect(mockPrisma.knowledgeEdge.delete).toHaveBeenCalledWith({
        where: { edgeId: 'test-edge' },
      });
      expect(result).toEqual(mockEdge);
    });

    it('should throw NotFoundException when deleting nonexistent', async () => {
      mockPrisma.knowledgeEdge.findUnique.mockResolvedValue(null);

      await expect(service.deleteEdge('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.knowledgeEdge.delete).not.toHaveBeenCalled();
    });
  });

  // ─── Graph Query Engine ──────────────────────────────────────────────────

  describe('queryImpact', () => {
    it('should return impacted nodes via CTE', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(mockNode);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'node-internal-2',
          node_id: 'test-node-2',
          type: 'CODE',
          label: 'Test Node 2',
          description: null,
          module: 'test',
          depth: 1,
        },
      ]);

      const result = await service.queryImpact('test-node', 5);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].nodeId).toBe('test-node-2');
      expect(result.nodes[0].depth).toBe(1);
    });

    it('should throw NotFoundException when node not found', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);

      await expect(service.queryImpact('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should clamp depth between 1 and 10', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(mockNode);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      await service.queryImpact('test-node', 100);

      // The depth should be clamped to 10
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.any(String),
        'node-internal-1',
        10,
      );
    });

    it('should throw BadRequestException when query fails', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(mockNode);
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('DB error'));

      await expect(service.queryImpact('test-node')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('queryPath', () => {
    it('should find a path between two nodes', async () => {
      mockPrisma.knowledgeNode.findUnique
        .mockResolvedValueOnce(mockNode) // from
        .mockResolvedValueOnce(mockNode2); // to

      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'node-internal-2',
          node_id: 'test-node-2',
          type: 'CODE',
          label: 'Test Node 2',
          description: null,
          module: 'test',
          depth: 1,
        },
      ]);

      const result = await service.queryPath('test-node', 'test-node-2');

      expect(result.found).toBe(true);
      expect(result.path).toHaveLength(2);
      expect(result.totalDepth).toBe(1);
      expect(result.path[0].nodeId).toBe('test-node');
      expect(result.path[1].nodeId).toBe('test-node-2');
    });

    it('should return trivial path when from and to are the same node', async () => {
      mockPrisma.knowledgeNode.findUnique
        .mockResolvedValueOnce(mockNode)
        .mockResolvedValueOnce(mockNode);

      const result = await service.queryPath('test-node', 'test-node');

      expect(result.found).toBe(true);
      expect(result.path).toHaveLength(1);
      expect(result.totalDepth).toBe(0);
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('should return found=false when no path exists', async () => {
      mockPrisma.knowledgeNode.findUnique
        .mockResolvedValueOnce(mockNode)
        .mockResolvedValueOnce(mockNode2);

      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.queryPath('test-node', 'test-node-2');

      expect(result.found).toBe(false);
      expect(result.path).toHaveLength(0);
      expect(result.totalDepth).toBe(0);
    });

    it('should throw NotFoundException for invalid node IDs', async () => {
      mockPrisma.knowledgeNode.findUnique
        .mockResolvedValueOnce(null) // from not found
        .mockResolvedValueOnce(mockNode2);

      await expect(
        service.queryPath('nonexistent', 'test-node-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on query failure', async () => {
      mockPrisma.knowledgeNode.findUnique
        .mockResolvedValueOnce(mockNode)
        .mockResolvedValueOnce(mockNode2);
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('DB error'));

      await expect(
        service.queryPath('test-node', 'test-node-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('queryNeighbors', () => {
    it('should return neighbors for a node', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(mockNode);
      mockPrisma.knowledgeEdge.findMany
        .mockResolvedValueOnce([
          { ...mockEdge, targetNode: mockNode2 },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.queryNeighbors('test-node');

      expect(result.outgoing).toHaveLength(1);
      expect(result.incoming).toHaveLength(0);
      expect(result.outgoing[0].node.nodeId).toBe('test-node-2');
      expect(result.outgoing[0].edge.type).toBe(EdgeType.DEPENDS_ON);
    });

    it('should filter by edge type', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(mockNode);
      mockPrisma.knowledgeEdge.findMany.mockResolvedValue([]);
      mockPrisma.knowledgeEdge.findMany.mockResolvedValue([]);

      await service.queryNeighbors('test-node', 'DEPENDS_ON');

      expect(mockPrisma.knowledgeEdge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'DEPENDS_ON' }),
        }),
      );
    });

    it('should throw NotFoundException for invalid node', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);

      await expect(service.queryNeighbors('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('queryNodes', () => {
    it('should return filtered nodes', async () => {
      mockPrisma.knowledgeNode.findMany.mockResolvedValue([mockNode]);

      const result = await service.queryNodes({
        type: NodeType.ARCHITECTURE,
        module: 'test',
      });

      expect(result).toHaveLength(1);
      expect(mockPrisma.knowledgeNode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: NodeType.ARCHITECTURE,
            module: 'test',
            isActive: true,
          }),
        }),
      );
    });

    it('should apply search filter', async () => {
      mockPrisma.knowledgeNode.findMany.mockResolvedValue([]);

      await service.queryNodes({ search: 'keyword' });

      expect(mockPrisma.knowledgeNode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                label: { contains: 'keyword', mode: 'insensitive' },
              }),
            ]),
          }),
        }),
      );
    });

    it('should return empty array when no matches', async () => {
      mockPrisma.knowledgeNode.findMany.mockResolvedValue([]);

      const result = await service.queryNodes({
        type: NodeType.REQUIREMENT,
      });

      expect(result).toHaveLength(0);
    });
  });
});
