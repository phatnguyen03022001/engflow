/* @lifecycle ACTIVE — Unit tests for KnowledgeController */

import { Test, TestingModule } from '@nestjs/testing';
import { NodeType, EdgeType, UserRole } from '@prisma/client';
import { KnowledgeController } from '../knowledge.controller';
import { KnowledgeGraphService } from '../services/knowledge-graph.service';
import { KnowledgeSyncService } from '../services/knowledge-sync.service';
import { CreateNodeDto } from '../dto/create-node.dto';
import { QueryNodesDto, QueryEdgesDto } from '../dto/query-graph.dto';
import { CreateEdgeDto } from '../dto/create-edge.dto';

describe('KnowledgeController', () => {
  let controller: KnowledgeController;
  let graphService: jest.Mocked<KnowledgeGraphService>;
  let syncService: jest.Mocked<KnowledgeSyncService>;

  const mockGraphService = {
    createNode: jest.fn(),
    findNodes: jest.fn(),
    findNodeByNodeId: jest.fn(),
    updateNode: jest.fn(),
    deactivateNode: jest.fn(),
    createEdge: jest.fn(),
    findEdges: jest.fn(),
    deleteEdge: jest.fn(),
    queryImpact: jest.fn(),
    queryPath: jest.fn(),
    queryNeighbors: jest.fn(),
    queryNodes: jest.fn(),
  };

  const mockSyncService = {
    syncFromFileScan: jest.fn(),
  };

  const mockNode = {
    id: 'node-1',
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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeController],
      providers: [
        { provide: KnowledgeGraphService, useValue: mockGraphService },
        { provide: KnowledgeSyncService, useValue: mockSyncService },
      ],
    }).compile();

    controller = module.get<KnowledgeController>(KnowledgeController);
    graphService = module.get(KnowledgeGraphService);
    syncService = module.get(KnowledgeSyncService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── Node Endpoints ──────────────────────────────────────────────────────

  describe('createNode', () => {
    it('should call graphService.createNode with DTO', async () => {
      const dto = {
        nodeId: 'new-node',
        type: NodeType.ARCHITECTURE,
        label: 'New Node',
      };
      mockGraphService.createNode.mockResolvedValue(mockNode);

      const result = await controller.createNode(dto as unknown as CreateNodeDto);

      expect(graphService.createNode).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockNode);
    });
  });

  describe('findNodes', () => {
    it('should call graphService.findNodes with query params', async () => {
      const query = { type: NodeType.CODE, module: 'auth', skip: 0, take: 10 };
      const expected = { items: [mockNode], total: 1 };
      mockGraphService.findNodes.mockResolvedValue(expected);

      const result = await controller.findNodes(query as unknown as QueryNodesDto);

      expect(graphService.findNodes).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });

    it('should call findNodes with empty query', async () => {
      mockGraphService.findNodes.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.findNodes({} as unknown as QueryNodesDto);

      expect(graphService.findNodes).toHaveBeenCalledWith({});
      expect(result.total).toBe(0);
    });
  });

  describe('findNode', () => {
    it('should call graphService.findNodeByNodeId', async () => {
      mockGraphService.findNodeByNodeId.mockResolvedValue(mockNode);

      const result = await controller.findNode('test-node');

      expect(graphService.findNodeByNodeId).toHaveBeenCalledWith('test-node');
      expect(result).toEqual(mockNode);
    });
  });

  describe('updateNode', () => {
    it('should call graphService.updateNode with nodeId and DTO', async () => {
      const dto = { label: 'Updated Label' };
      mockGraphService.updateNode.mockResolvedValue({
        ...mockNode,
        label: 'Updated Label',
      });

      const result = await controller.updateNode('test-node', dto);

      expect(graphService.updateNode).toHaveBeenCalledWith('test-node', dto);
      expect(result.label).toBe('Updated Label');
    });
  });

  describe('deactivateNode', () => {
    it('should call graphService.deactivateNode', async () => {
      mockGraphService.deactivateNode.mockResolvedValue({
        ...mockNode,
        isActive: false,
      });

      const result = await controller.deactivateNode('test-node');

      expect(graphService.deactivateNode).toHaveBeenCalledWith('test-node');
      expect(result.isActive).toBe(false);
    });
  });

  // ─── Edge Endpoints ──────────────────────────────────────────────────────

  describe('createEdge', () => {
    it('should call graphService.createEdge with DTO', async () => {
      const dto = {
        edgeId: 'new-edge',
        sourceNodeId: 'node-a',
        targetNodeId: 'node-b',
        type: EdgeType.DEPENDS_ON,
      };
      const mockEdge = {
        id: 'edge-1',
        edgeId: 'new-edge',
        sourceNodeId: 'node-a-internal',
        targetNodeId: 'node-b-internal',
        type: EdgeType.DEPENDS_ON,
        weight: 1.0,
        properties: null,
        description: null,
        createdAt: new Date(),
      };
      mockGraphService.createEdge.mockResolvedValue(mockEdge);

      const result = await controller.createEdge(dto as unknown as CreateEdgeDto);

      expect(graphService.createEdge).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockEdge);
    });
  });

  describe('findEdges', () => {
    it('should call graphService.findEdges with query params', async () => {
      const query = { type: EdgeType.DEPENDS_ON };
      const expected = { items: [], total: 0 };
      mockGraphService.findEdges.mockResolvedValue(expected);

      const result = await controller.findEdges(query as unknown as QueryEdgesDto);

      expect(graphService.findEdges).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });
  });

  describe('deleteEdge', () => {
    it('should call graphService.deleteEdge', async () => {
      mockGraphService.deleteEdge.mockResolvedValue({ deleted: true });

      const result = await controller.deleteEdge('edge-to-delete');

      expect(graphService.deleteEdge).toHaveBeenCalledWith('edge-to-delete');
      expect(result).toEqual({ deleted: true });
    });
  });

  // ─── Graph Query Endpoints ───────────────────────────────────────────────

  describe('queryImpact', () => {
    it('should call graphService.queryImpact with default depth', async () => {
      const mockResult = { nodes: [] };
      mockGraphService.queryImpact.mockResolvedValue(mockResult);

      const result = await controller.queryImpact('test-node', undefined);

      expect(graphService.queryImpact).toHaveBeenCalledWith('test-node', 3);
      expect(result).toEqual(mockResult);
    });

    it('should call graphService.queryImpact with parsed depth', async () => {
      mockGraphService.queryImpact.mockResolvedValue({ nodes: [] });

      await controller.queryImpact('test-node', '5');

      expect(graphService.queryImpact).toHaveBeenCalledWith('test-node', 5);
    });
  });

  describe('queryPath', () => {
    it('should call graphService.queryPath', async () => {
      const mockResult = {
        found: true,
        path: [],
        totalDepth: 0,
      };
      mockGraphService.queryPath.mockResolvedValue(mockResult);

      const result = await controller.queryPath('node-a', 'node-b');

      expect(graphService.queryPath).toHaveBeenCalledWith('node-a', 'node-b');
      expect(result).toEqual(mockResult);
    });
  });

  describe('queryNeighbors', () => {
    it('should call graphService.queryNeighbors without edgeType', async () => {
      const mockResult = { outgoing: [], incoming: [] };
      mockGraphService.queryNeighbors.mockResolvedValue(mockResult);

      const result = await controller.queryNeighbors('test-node', undefined);

      expect(graphService.queryNeighbors).toHaveBeenCalledWith(
        'test-node',
        undefined,
      );
      expect(result).toEqual(mockResult);
    });

    it('should call graphService.queryNeighbors with edgeType', async () => {
      mockGraphService.queryNeighbors.mockResolvedValue({
        outgoing: [],
        incoming: [],
      });

      await controller.queryNeighbors('test-node', 'DEPENDS_ON');

      expect(graphService.queryNeighbors).toHaveBeenCalledWith(
        'test-node',
        'DEPENDS_ON',
      );
    });
  });

  // ─── Sync Endpoint ───────────────────────────────────────────────────────

  // ─── Impact Analysis Endpoint ─────────────────────────────────────────────

  describe('queryImpactByDepth', () => {
    it('should call graphService.queryImpact with default depth', async () => {
      const mockResult = { nodes: [] };
      mockGraphService.queryImpact.mockResolvedValue(mockResult);

      const result = await controller.queryImpactByDepth('test-node', undefined);

      expect(graphService.queryImpact).toHaveBeenCalledWith('test-node', 3);
      expect(result).toEqual(mockResult);
    });

    it('should call graphService.queryImpact with parsed depth', async () => {
      mockGraphService.queryImpact.mockResolvedValue({ nodes: [] });

      await controller.queryImpactByDepth('test-node', '5');

      expect(graphService.queryImpact).toHaveBeenCalledWith('test-node', 5);
    });
  });

  // ─── Sync Endpoint ─────────────────────────────────────────────────────────

  describe('triggerSync', () => {
    it('should call syncService.syncFromFileScan', async () => {
      const syncResult = {
        nodesCreated: 16,
        edgesCreated: 12,
        errors: [],
      };
      mockSyncService.syncFromFileScan.mockResolvedValue(syncResult);

      const result = await controller.triggerSync();

      expect(syncService.syncFromFileScan).toHaveBeenCalled();
      expect(result).toEqual(syncResult);
    });
  });
});
