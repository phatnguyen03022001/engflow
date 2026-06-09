/* @lifecycle ACTIVE — Unit tests for KnowledgeSyncService */

import { Test, TestingModule } from '@nestjs/testing';
import { promises as fs } from 'fs';
import { ConfigService } from '@nestjs/config';
import { KnowledgeSyncService } from '../services/knowledge-sync.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readdir: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn(),
  },
}));

describe('KnowledgeSyncService', () => {
  let service: KnowledgeSyncService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    knowledgeNode: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    knowledgeEdge: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    // Clear Prisma mock call history (accumulated across tests)
    // NOTE: We intentionally do NOT call jest.clearAllMocks() because it also
    // clears the jest.fn() instances inside jest.mock('fs', ...), which
    // destroys mockResolvedValueOnce/mockRejectedValueOnce configs.
    // The inner beforeEach uses mockReset() on fs mocks for fresh state.
    mockPrisma.knowledgeNode.findUnique.mockClear();
    mockPrisma.knowledgeNode.findMany.mockClear();
    mockPrisma.knowledgeNode.create.mockClear();
    mockPrisma.knowledgeNode.update.mockClear();
    mockPrisma.knowledgeEdge.findUnique.mockClear();
    mockPrisma.knowledgeEdge.findMany.mockClear();
    mockPrisma.knowledgeEdge.create.mockClear();
    mockPrisma.$queryRawUnsafe.mockClear();
    mockConfigService.get.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeSyncService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<KnowledgeSyncService>(KnowledgeSyncService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncFromFileScan', () => {
    beforeEach(() => {
      // Reset fs mocks to clear any leftover state from previous tests
      (fs.readdir as jest.Mock).mockReset();
      (fs.stat as jest.Mock).mockReset();
      (fs.readFile as jest.Mock).mockReset();

      // Phase 1: scanSourceModules — 2 directories
      (fs.readdir as jest.Mock).mockResolvedValueOnce(['auth', 'user']);
      (fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => true });

      // Phase 2: scanDecisionFiles
      (fs.readdir as jest.Mock).mockResolvedValueOnce([
        '001-reuse-first-governance.md',
        '002-ask-virtual-cto-advisor.md',
      ]);

      // Phase 3: scanPrismaModels — 2 models
      (fs.readFile as jest.Mock).mockResolvedValueOnce(
        'model User {\n}\nmodel Lesson {\n}\n',
      );
    });

    it('should scan backend/src/ for module directories and create ARCHITECTURE nodes', async () => {
      // No existing nodes — all will be created
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);
      mockPrisma.knowledgeNode.create.mockResolvedValue({});

      const result = await service.syncFromFileScan();

      // 2 modules (auth, user) + 2 ADRs + 2 models = 6 new nodes
      expect(result.nodesCreated).toBe(6);
      expect(result.errors).toHaveLength(0);
    });

    it('should upsert existing nodes instead of creating duplicates', async () => {
      // Simulate existing node for mod-auth
      mockPrisma.knowledgeNode.findUnique
        .mockResolvedValueOnce({ id: 'existing-1' }) // mod-auth exists
        .mockResolvedValueOnce(null); // mod-user is new
      // Decision nodes — both new
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);
      // Model nodes — both new
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);

      mockPrisma.knowledgeNode.update.mockResolvedValue({});
      mockPrisma.knowledgeNode.create.mockResolvedValue({});

      const result = await service.syncFromFileScan();

      // 1 existing (updated) + 5 new = 5 nodesCreated
      expect(result.nodesCreated).toBe(5);
      expect(mockPrisma.knowledgeNode.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { nodeId: 'mod-auth' },
        }),
      );
      expect(mockPrisma.knowledgeNode.create).toHaveBeenCalledTimes(5);
    });

    it('should gracefully handle unreadable directories', async () => {
      // Reset fs mocks for custom failure setup
      (fs.readdir as jest.Mock).mockReset();
      (fs.readFile as jest.Mock).mockReset();

      // Phase 1 fails
      (fs.readdir as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));
      // Phase 2 succeeds
      (fs.readdir as jest.Mock).mockResolvedValueOnce(['001-test.md']);
      // Phase 3 succeeds
      (fs.readFile as jest.Mock).mockResolvedValueOnce('model User {\n}');

      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);
      mockPrisma.knowledgeNode.create.mockResolvedValue({});

      const result = await service.syncFromFileScan();

      // 1 ADR + 1 model = 2
      expect(result.nodesCreated).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should create nodes with correct types and metadata', async () => {
      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);
      mockPrisma.knowledgeNode.create.mockResolvedValue({});

      await service.syncFromFileScan();

      // Verify first module node
      expect(mockPrisma.knowledgeNode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nodeId: 'mod-auth',
            type: 'ARCHITECTURE',
            label: 'Auth Module',
            module: 'auth',
            sourceFile: 'backend/src/auth/',
            isActive: true,
          }),
        }),
      );

      // Verify first ADR node
      expect(mockPrisma.knowledgeNode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nodeId: '001-reuse-first-governance',
            type: 'DECISION',
            label: '001-reuse-first-governance.md',
            module: 'core',
            sourceFile: 'docs/decisions/001-reuse-first-governance.md',
            isActive: true,
          }),
        }),
      );

      // Verify first model node
      expect(mockPrisma.knowledgeNode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nodeId: 'model:User',
            type: 'CODE',
            label: 'User',
            module: 'prisma',
            sourceFile: 'backend/prisma/schema.prisma',
            isActive: true,
          }),
        }),
      );
    });

    it('should handle fs errors without crashing', async () => {
      // Reset fs mocks for custom failure setup
      (fs.readdir as jest.Mock).mockReset();
      (fs.stat as jest.Mock).mockReset();
      (fs.readFile as jest.Mock).mockReset();

      // All phases fail
      (fs.readdir as jest.Mock).mockRejectedValueOnce(new Error('EACCES'));
      (fs.readdir as jest.Mock).mockRejectedValueOnce(new Error('EACCES'));
      (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));

      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);
      mockPrisma.knowledgeNode.create.mockResolvedValue({});

      const result = await service.syncFromFileScan();

      expect(result.nodesCreated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should filter out non-directory entries during module scan', async () => {
      // Reset fs mocks for custom setup
      (fs.readdir as jest.Mock).mockReset();
      (fs.stat as jest.Mock).mockReset();
      (fs.readFile as jest.Mock).mockReset();

      // Phase 1: one file, one directory
      (fs.readdir as jest.Mock).mockResolvedValueOnce(['file.txt', 'auth']);
      (fs.stat as jest.Mock).mockResolvedValueOnce({ isDirectory: () => false }); // file.txt
      (fs.stat as jest.Mock).mockResolvedValueOnce({ isDirectory: () => true }); // auth

      // Phase 2: no decision files (empty dir)
      (fs.readdir as jest.Mock).mockResolvedValueOnce([]);

      // Phase 3: no models
      (fs.readFile as jest.Mock).mockResolvedValueOnce('// empty schema');

      mockPrisma.knowledgeNode.findUnique.mockResolvedValue(null);
      mockPrisma.knowledgeNode.create.mockResolvedValue({});

      const result = await service.syncFromFileScan();

      // Only auth module created (file.txt is not a directory)
      expect(result.nodesCreated).toBe(1);
      expect(mockPrisma.knowledgeNode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nodeId: 'mod-auth' }),
        }),
      );
    });
  });
});
