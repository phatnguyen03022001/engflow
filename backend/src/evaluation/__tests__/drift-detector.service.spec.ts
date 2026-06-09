/* @lifecycle ACTIVE — Unit tests for DriftDetectorService */
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs/promises';
import { DriftDetectorService } from '../services/drift-detector.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { DetectorType, Severity } from '../interfaces/drift-detector.interface';

// Mock fs/promises
jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;

/* ─── Helpers for mock Dirent objects ────────────────────────────────────
 * The walk() in collectSourceFiles calls entry.isDirectory() on every entry
 * and then entry.isFile() on non-directories. Every mock entry MUST provide
 * both methods to avoid silent TypeError caught by the try/catch.
 */
const dir = (name: string) =>
  ({ name, isDirectory: () => true, isFile: () => false }) as any;

const file = (name: string) =>
  ({ name, isDirectory: () => false, isFile: () => true }) as any;

function setupMockReaddir() {
  mockFs.readdir.mockReset();
  mockFs.readdir.mockResolvedValue([]); // default fallback
}

/** Queue sequential readdir return values. Falls back to [] when exhausted. */
function queueReaddir(results: Array<ReturnType<typeof dir>[]>) {
  for (const r of results) {
    mockFs.readdir.mockResolvedValueOnce(r);
  }
}

function setupMockReadFile(defaultContent = '') {
  mockFs.readFile.mockReset();
  mockFs.readFile.mockResolvedValue(defaultContent);
}

function queueReadFile(contents: string[]) {
  for (const c of contents) {
    mockFs.readFile.mockResolvedValueOnce(c);
  }
}

describe('DriftDetectorService', () => {
  let service: DriftDetectorService;
  let mockPrisma: any;

  const now = new Date('2026-06-09T12:00:00Z');

  const baseDriftEvent = (overrides: Record<string, unknown> = {}) => ({
    id: 'evt-001',
    detectorType: 'STRUCTURE',
    severity: 'MEDIUM',
    title: 'Test drift',
    description: 'Test description',
    sourcePath: null,
    expectedValue: null,
    actualValue: null,
    isResolved: false,
    resolvedAt: null,
    detectedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

  function setupPrisma() {
    mockPrisma = {
      driftEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve(baseDriftEvent({
            detectorType: data.detectorType,
            severity: data.severity,
            title: data.title,
            description: data.description,
            sourcePath: data.sourcePath,
            expectedValue: data.expectedValue,
            actualValue: data.actualValue,
          })),
        ),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve(baseDriftEvent({
            ...data,
            resolvedAt: data.resolvedAt ?? null,
          })),
        ),
      },
    };
  }

  beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    jest.useFakeTimers().setSystemTime(now);
    jest.spyOn(process, 'cwd').mockReturnValue('/test/project/backend');

    setupPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriftDetectorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DriftDetectorService>(DriftDetectorService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── runFullDetection ───────────────────────────────────────────────

  describe('runFullDetection', () => {
    it('should return empty array when no drift detected', async () => {
      setupMockReaddir();
      queueReaddir([
        [dir('shared'), dir('auth')], // structure: src/
        [],                           // policy: rootDir (empty → no files)
      ]);
      setupMockReadFile();
      queueReadFile([
        '### Module Structure\nsrc/\n├── shared/\n├── auth/\n',
      ]);

      const result = await service.runFullDetection();

      expect(result).toEqual([]);
      expect(mockPrisma.driftEvent.create).not.toHaveBeenCalled();
    });

    it('should detect structure drift for undocumented modules', async () => {
      setupMockReaddir();
      queueReaddir([
        [dir('shared'), dir('auth'), dir('new-module')], // structure
        [file('new-module.service.ts'), file('new-module.module.ts')], // countSourceFiles
        [], // policy
      ]);
      setupMockReadFile();
      queueReadFile([
        '### Module Structure\nsrc/\n├── shared/\n├── auth/\n',
      ]);

      const result = await service.runFullDetection();

      expect(result).toHaveLength(1);
      expect(result[0].title).toContain('Undocumented module');
      expect(result[0].detectorType).toBe(DetectorType.STRUCTURE);
      expect(result[0].severity).toBe(Severity.MEDIUM);
      expect(result[0].sourcePath).toContain('new-module');
    });

    it('should detect structure drift for missing modules', async () => {
      setupMockReaddir();
      queueReaddir([
        [dir('shared')], // structure: only shared in src
        [],              // policy
      ]);
      setupMockReadFile();
      queueReadFile([
        '### Module Structure\nsrc/\n├── shared/\n├── auth/\n',
      ]);

      const result = await service.runFullDetection();

      expect(result).toHaveLength(1);
      expect(result[0].title).toContain('Missing module');
      expect(result[0].detectorType).toBe(DetectorType.STRUCTURE);
      expect(result[0].severity).toBe(Severity.HIGH);
    });

    it('should detect policy drift for missing lifecycle declarations', async () => {
      mockFs.readdir.mockReset();
      mockFs.readdir.mockResolvedValue([]);
      // 1: structure src/
      mockFs.readdir.mockResolvedValueOnce([] as any);
      // 2: policy rootDir → contains src/
      mockFs.readdir.mockResolvedValueOnce([dir('src')]);
      // 3: policy walk src/ → contains bad-file.ts
      mockFs.readdir.mockResolvedValueOnce([file('bad-file.ts')]);

      mockFs.readFile.mockReset();
      mockFs.readFile.mockImplementation((filePath: any) => {
        if (String(filePath).includes('architecture.md')) {
          return Promise.resolve('### Module Structure\nsrc/\n');
        }
        return Promise.resolve('export const x = 1;\n');
      });

      const result = await service.runFullDetection();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Missing lifecycle declaration');
      expect(result[0].detectorType).toBe(DetectorType.POLICY);
      expect(result[0].severity).toBe(Severity.MEDIUM);
    });

    it('should detect policy drift for any types', async () => {
      mockFs.readdir.mockReset();
      mockFs.readdir.mockResolvedValue([]);
      mockFs.readdir.mockResolvedValueOnce([] as any);
      mockFs.readdir.mockResolvedValueOnce([dir('src')]);
      mockFs.readdir.mockResolvedValueOnce([file('has-any.ts')]);

      mockFs.readFile.mockReset();
      mockFs.readFile.mockImplementation((filePath: any) => {
        if (String(filePath).includes('architecture.md')) {
          return Promise.resolve('### Module Structure\nsrc/\n');
        }
        return Promise.resolve('/* @lifecycle ACTIVE — test */\nconst x: any = 1;\n');
      });

      const result = await service.runFullDetection();
      // Title format: '`any` type usage detected' (with backticks from template literal)
      expect(result.some((r) => r.title.includes('any'))).toBe(true);
    });

    it('should detect policy drift for console.log usage', async () => {
      mockFs.readdir.mockReset();
      mockFs.readdir.mockResolvedValue([]);
      mockFs.readdir.mockResolvedValueOnce([] as any);
      mockFs.readdir.mockResolvedValueOnce([dir('src')]);
      mockFs.readdir.mockResolvedValueOnce([file('has-console.ts')]);

      mockFs.readFile.mockReset();
      mockFs.readFile.mockImplementation((filePath: any) => {
        if (String(filePath).includes('architecture.md')) {
          return Promise.resolve('### Module Structure\nsrc/\n');
        }
        return Promise.resolve('/* @lifecycle ACTIVE — test */\nconsole.log("test");\n');
      });

      const result = await service.runFullDetection();
      expect(result.some((r) => r.title.includes('console'))).toBe(true);
    });

    it('should auto-resolve previously detected drifts no longer present', async () => {
      setupMockReaddir();
      queueReaddir([
        [dir('shared')], // structure: shared in src
        [],              // policy: empty
      ]);
      setupMockReadFile();
      queueReadFile([
        '### Module Structure\nsrc/\n├── shared/\n',
      ]);

      // One old unresolved event that no longer matches
      mockPrisma.driftEvent.findMany.mockResolvedValue([
        baseDriftEvent({
          id: 'old-001',
          detectorType: 'STRUCTURE',
          title: 'Missing module: old-module',
          sourcePath: 'docs/architecture.md',
          isResolved: false,
        }),
      ]);

      const result = await service.runFullDetection();

      expect(mockPrisma.driftEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'old-001' },
          data: expect.objectContaining({
            isResolved: true,
            resolvedAt: expect.any(Date),
          }),
        }),
      );
      expect(result).toHaveLength(0);
    });

    it('should skip duplicate unresolved events', async () => {
      setupMockReaddir();
      queueReaddir([
        [dir('shared'), dir('new-module')],
        [file('test.ts')], // countSourceFiles for new-module
        [],                // policy
      ]);
      setupMockReadFile();
      queueReadFile([
        '### Module Structure\nsrc/\n├── shared/\n',
      ]);

      // findMatchingUnresolved returns existing event → skip create
      mockPrisma.driftEvent.findFirst.mockResolvedValue(
        baseDriftEvent({
          id: 'existing-001',
          title: 'Undocumented module: new-module',
          isResolved: false,
        }),
      );

      const result = await service.runFullDetection();

      expect(result).toHaveLength(0);
      expect(mockPrisma.driftEvent.create).not.toHaveBeenCalled();
    });

    it('should handle fs readdir errors gracefully', async () => {
      setupMockReadFile();

      // src/ readdir throws
      mockFs.readdir.mockReset();
      mockFs.readdir.mockRejectedValueOnce(new Error('Permission denied'));

      mockPrisma.driftEvent.findMany.mockResolvedValue([]);

      const result = await service.runFullDetection();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Cannot scan backend/src/ directory');
      expect(result[0].severity).toBe(Severity.HIGH);
    });

    it('should handle arch.md read errors gracefully', async () => {
      setupMockReaddir();
      queueReaddir([
        [dir('shared')],
      ]);

      mockFs.readFile.mockReset();
      mockFs.readFile.mockRejectedValueOnce(new Error('File not found'));

      mockPrisma.driftEvent.findMany.mockResolvedValue([]);

      const result = await service.runFullDetection();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Architecture documentation not found');
      expect(result[0].severity).toBe(Severity.HIGH);
    });
  });

  // ─── queryEvents ────────────────────────────────────────────────────

  describe('queryEvents', () => {
    it('should return paginated drift events', async () => {
      mockPrisma.driftEvent.findMany.mockResolvedValue([
        baseDriftEvent({ id: 'evt-001', title: 'First event' }),
        baseDriftEvent({ id: 'evt-002', title: 'Second event' }),
      ]);
      mockPrisma.driftEvent.count.mockResolvedValue(2);

      const result = await service.queryEvents({});

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrisma.driftEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { detectedAt: 'desc' } }),
      );
    });

    it('should apply detectorType filter', async () => {
      await service.queryEvents({ detectorType: DetectorType.POLICY });

      expect(mockPrisma.driftEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ detectorType: 'POLICY' }),
        }),
      );
    });

    it('should apply isResolved filter', async () => {
      await service.queryEvents({ isResolved: true });

      expect(mockPrisma.driftEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isResolved: true }),
        }),
      );
    });

    it('should enforce max page size of 100', async () => {
      await service.queryEvents({ take: 999 });

      expect(mockPrisma.driftEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should apply skip and take for pagination', async () => {
      await service.queryEvents({ skip: 20, take: 10 });

      expect(mockPrisma.driftEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // ─── API Contract (passive v1) ──────────────────────────────────────

  describe('api contract drift detection (v1)', () => {
    it('should return no API contract events (passive in v1)', async () => {
      setupMockReaddir();
      queueReaddir([
        [],
        [],
      ]);
      setupMockReadFile();
      queueReadFile([
        '### Module Structure\nsrc/\n',
      ]);

      const result = await service.runFullDetection();

      expect(result.every((r) => r.detectorType !== DetectorType.API_CONTRACT)).toBe(true);
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should flag modules as undocumented when arch.md is empty', async () => {
      setupMockReaddir();
      queueReaddir([
        [dir('shared')],
        [file('shared.service.ts')], // countSourceFiles
        [],                          // policy
      ]);
      setupMockReadFile();
      queueReadFile([
        '', // empty arch.md
      ]);

      const result = await service.runFullDetection();

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].title).toContain('Undocumented');
    });

    it('should not create duplicates when unresolved event exists', async () => {
      setupMockReaddir();
      queueReaddir([
        [dir('shared'), dir('new-module')],
        [file('test.ts')], // countSourceFiles
        [],                // policy
      ]);
      setupMockReadFile();
      queueReadFile([
        '### Module Structure\nsrc/\n├── shared/\n',
      ]);

      // findMatchingUnresolved returns existing event → skip create
      mockPrisma.driftEvent.findFirst.mockResolvedValue(
        baseDriftEvent({
          id: 'existing-evt',
          title: 'Undocumented module: new-module',
          isResolved: false,
        }),
      );

      const result = await service.runFullDetection();
      expect(result).toHaveLength(0);
      expect(mockPrisma.driftEvent.create).not.toHaveBeenCalled();
    });
  });
});
