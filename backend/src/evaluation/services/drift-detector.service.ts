/* @lifecycle ACTIVE — Drift detection orchestrator service (ADR-013) */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  DriftDetectionResult,
  DetectorType,
  Severity,
  DriftEventQuery,
  DriftEventResponse,
} from '../interfaces/drift-detector.interface';

@Injectable()
export class DriftDetectorService {
  private readonly logger = new Logger(DriftDetectorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run all drift detection strategies and persist results.
   * Returns newly created DriftEvent records.
   */
  async runFullDetection(): Promise<DriftEventResponse[]> {
    this.logger.log('Starting full drift detection cycle...');

    const allResults: DriftDetectionResult[] = [
      ...(await this.detectStructureDrift()),
      ...(await this.detectPolicyDrift()),
      ...(await this.detectApiContractDrift()),
    ];

    // Auto-resolve previously detected drifts no longer present in current scan
    await this.autoResolveDrifts(allResults);

    // Save new drift events (skip duplicates — same detectorType+title+sourcePath)
    const savedEvents: DriftEventResponse[] = [];
    for (const result of allResults) {
      const existing = await this.findMatchingUnresolved(result);
      if (!existing) {
        const event = await this.prisma.driftEvent.create({
          data: {
            detectorType: result.detectorType,
            severity: result.severity,
            title: result.title,
            description: result.description,
            sourcePath: result.sourcePath ?? null,
            expectedValue: result.expectedValue ?? null,
            actualValue: result.actualValue ?? null,
            isResolved: false,
            detectedAt: new Date(),
          },
        });
        savedEvents.push(this.mapToResponse(event));
        this.logger.log(
          `[${result.severity}] ${result.title} — ${result.description.substring(0, 80)}`,
        );
      }
    }

    this.logger.log(
      `Drift detection complete: ${savedEvents.length} new events, auto-resolved previous resolved drifts`,
    );
    return savedEvents;
  }

  /**
   * Query drift events with optional filters and pagination.
   */
  async queryEvents(
    query: DriftEventQuery,
  ): Promise<{ items: DriftEventResponse[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (query.detectorType) {
      where.detectorType = query.detectorType;
    }
    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.isResolved !== undefined) {
      where.isResolved = query.isResolved;
    }

    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? 20, 100);

    const [items, total] = await Promise.all([
      this.prisma.driftEvent.findMany({
        where,
        skip,
        take,
        orderBy: { detectedAt: 'desc' },
      }),
      this.prisma.driftEvent.count({ where }),
    ]);

    return {
      items: items.map((e) => this.mapToResponse(e)),
      total,
    };
  }

  // ─── Strategy A: Structure Check ──────────────────────────────────────

  /**
   * Compare the actual source tree against the module inventory
   * documented in architecture.md.
   */
  private async detectStructureDrift(): Promise<DriftDetectionResult[]> {
    const results: DriftDetectionResult[] = [];
    const backendSrc = path.resolve(process.cwd(), 'src');

    // Get actual module directories from backend/src/
    let actualModules: string[];
    try {
      const srcEntries = await fs.readdir(backendSrc, { withFileTypes: true });
      actualModules = srcEntries
        .filter((e) => e.isDirectory() && !e.name.startsWith('__'))
        .map((e) => e.name);
    } catch {
      results.push({
        detectorType: DetectorType.STRUCTURE,
        severity: Severity.HIGH,
        title: 'Cannot scan backend/src/ directory',
        description: `Failed to read directory at ${backendSrc}. The application may be running outside the expected context.`,
        expectedValue: 'Accessible backend/src/ directory',
        actualValue: 'Directory unreadable or not found',
      });
      return results;
    }

    // Parse architecture.md for documented modules
    const archPath = path.resolve(process.cwd(), '..', 'docs', 'architecture.md');
    let documentedModules: Set<string>;
    try {
      const archContent = await fs.readFile(archPath, 'utf-8');
      documentedModules = this.parseDocumentedModules(archContent);
    } catch {
      results.push({
        detectorType: DetectorType.STRUCTURE,
        severity: Severity.HIGH,
        title: 'Architecture documentation not found',
        description: `Could not read architecture.md at ${archPath}. The documentation may be missing or the app is running from an unexpected directory.`,
        sourcePath: 'docs/architecture.md',
        expectedValue: 'Architecture document with module inventory',
        actualValue: 'File not readable or missing',
      });
      return results;
    }

    // Find undocumented modules (exist in code but not in docs)
    for (const mod of actualModules) {
      if (!documentedModules.has(mod)) {
        const fileCount = await this.countSourceFiles(
          path.join(backendSrc, mod),
        );
        results.push({
          detectorType: DetectorType.STRUCTURE,
          severity: Severity.MEDIUM,
          title: `Undocumented module: ${mod}`,
          description: `Module '${mod}' exists in backend/src/ but is not listed in architecture.md. Contains ${fileCount} source files.`,
          sourcePath: `backend/src/${mod}/`,
          expectedValue: `Module '${mod}' documented in architecture.md module inventory`,
          actualValue: `Module exists in codebase but missing from documentation`,
        });
      }
    }

    // Find missing modules (documented but not in code)
    for (const mod of documentedModules) {
      if (!actualModules.includes(mod)) {
        results.push({
          detectorType: DetectorType.STRUCTURE,
          severity: Severity.HIGH,
          title: `Missing module: ${mod}`,
          description: `Module '${mod}' is documented in architecture.md but does not exist in backend/src/.`,
          sourcePath: 'docs/architecture.md',
          expectedValue: `Module '${mod}' exists in backend/src/`,
          actualValue: `Module directory not found in codebase`,
        });
      }
    }

    return results;
  }

  // ─── Strategy B: Policy Check ─────────────────────────────────────────

  /**
   * Check for Constitution violations: lifecycle declarations,
   * `any` type usage, and `console.*` calls in production code.
   */
  private async detectPolicyDrift(): Promise<DriftDetectionResult[]> {
    const results: DriftDetectionResult[] = [];
    const rootDir = process.cwd();

    try {
      const sourceFiles = await this.collectSourceFiles(rootDir);

      // Check lifecycle declarations (ADR-008)
      const lifecycleIssues = await this.checkLifecycleDeclarations(sourceFiles);
      results.push(...lifecycleIssues);

      // Check for `any` type usage (Constitution §4)
      const anyTypeIssues = await this.checkAnyTypes(sourceFiles);
      results.push(...anyTypeIssues);

      // Check for console.* in production code (Constitution §4)
      const consoleIssues = await this.checkConsoleUsage(sourceFiles);
      results.push(...consoleIssues);
    } catch (error) {
      this.logger.error(
        `Policy drift detection failed: ${(error as Error).message}`,
      );
    }

    return results;
  }

  // ─── Strategy C: API Contract Check ───────────────────────────────────

  /**
   * In v1, API contract detection is passive — it logs a notice.
   * Full runtime route enumeration (via DiscoveryService) is deferred to a future iteration
   * as it requires a fully initialized NestJS application context.
   */
  private async detectApiContractDrift(): Promise<DriftDetectionResult[]> {
    this.logger.debug('API contract drift detection is passive in v1 (deferred to future iteration)');
    return [];
  }

  // ─── Auto-Resolve ────────────────────────────────────────────────────

  /**
   * Mark previously unresolved drifts as resolved if they no longer appear
   * in the current detection results.
   */
  private async autoResolveDrifts(
    currentResults: DriftDetectionResult[],
  ): Promise<void> {
    const unresolved = await this.prisma.driftEvent.findMany({
      where: { isResolved: false },
    });

    if (unresolved.length === 0) {
      return;
    }

    // Build a set of (detectorType::title::sourcePath) for current results
    const currentKeys = new Set<string>(
      currentResults.map(
        (r) => `${r.detectorType}::${r.title}::${r.sourcePath ?? ''}`,
      ),
    );

    let resolvedCount = 0;
    for (const event of unresolved) {
      const key = `${event.detectorType}::${event.title}::${event.sourcePath ?? ''}`;
      if (!currentKeys.has(key)) {
        await this.prisma.driftEvent.update({
          where: { id: event.id },
          data: {
            isResolved: true,
            resolvedAt: new Date(),
          },
        });
        resolvedCount++;
        this.logger.log(`Auto-resolved drift: ${event.title}`);
      }
    }

    if (resolvedCount > 0) {
      this.logger.log(`Auto-resolved ${resolvedCount} previously detected drifts`);
    }
  }

  /**
   * Find an existing unresolved event matching the given detection result.
   * Match is based on detectorType + title + sourcePath to avoid duplicates.
   */
  private async findMatchingUnresolved(
    result: DriftDetectionResult,
  ): Promise<{
    id: string;
    detectorType: string;
    severity: string;
    title: string;
    description: string;
    sourcePath: string | null;
    expectedValue: string | null;
    actualValue: string | null;
    isResolved: boolean;
    resolvedAt: Date | null;
    detectedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    return this.prisma.driftEvent.findFirst({
      where: {
        detectorType: result.detectorType,
        title: result.title,
        sourcePath: result.sourcePath ?? null,
        isResolved: false,
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /**
   * Parse architecture.md for documented module names.
   * Looks for the Module Structure section and extracts directory names
   * from lines like `├── <name>/` or `└── <name>/`.
   */
  private parseDocumentedModules(content: string): Set<string> {
    const modules = new Set<string>();
    const lines = content.split('\n');
    let inModuleSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect start of module structure section
      if (
        trimmed.includes('### Module Structure') ||
        trimmed === 'src/'
      ) {
        inModuleSection = true;
        continue;
      }

      if (inModuleSection) {
        // Stop at next heading or separator
        if (
          trimmed.startsWith('##') ||
          trimmed.startsWith('---') ||
          trimmed.startsWith('```')
        ) {
          if (modules.size > 0) break;
          continue;
        }

        // Match ├── <name>/ or └── <name>/
        const match =
          trimmed.match(/[├└]──\s+(\w[\w-]*)\//) ||
          trimmed.match(/├──\s+(\w[\w-]*)\//);
        if (match) {
          modules.add(match[1]);
        }

        // Also match lines with ✅ active markers:
        // ├── <name>/# ... ✅ active
        const activeMatch = trimmed.match(
          /[├└]──\s+(\w[\w-]*)\/.*✅\s+active/,
        );
        if (activeMatch) {
          modules.add(activeMatch[1]);
        }
      }
    }

    return modules;
  }

  /**
   * Recursively collect all non-test TypeScript source files
   * excluding node_modules, dist, .git, __tests__, and coverage directories.
   */
  private async collectSourceFiles(rootDir: string): Promise<string[]> {
    const files: string[] = [];
    const excludeDirs = new Set([
      'node_modules',
      'dist',
      '.git',
      '__tests__',
      'coverage',
    ]);

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!excludeDirs.has(entry.name)) {
              await walk(fullPath);
            }
          } else if (
            entry.isFile() &&
            entry.name.endsWith('.ts') &&
            !entry.name.endsWith('.spec.ts') &&
            !entry.name.endsWith('.e2e-spec.ts')
          ) {
            files.push(fullPath);
          }
        }
      } catch {
        // Silently skip directories we cannot read
      }
    };

    await walk(rootDir);
    return files;
  }

  /**
   * Verify that all source files have a valid @lifecycle declaration (ADR-008).
   */
  private async checkLifecycleDeclarations(
    files: string[],
  ): Promise<DriftDetectionResult[]> {
    const results: DriftDetectionResult[] = [];
    const lifecyclePattern =
      /@lifecycle\s+(ACTIVE|GENERATED|TEMPORARY|EXPERIMENTAL|ARCHIVED)/;

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const firstLine = content.split('\n')[0].trim();
        if (!lifecyclePattern.test(firstLine)) {
          const relativePath = path.relative(process.cwd(), file);
          results.push({
            detectorType: DetectorType.POLICY,
            severity: Severity.MEDIUM,
            title: 'Missing lifecycle declaration',
            description: `File ${relativePath} does not have a @lifecycle declaration in its first line. Required per ADR-008.`,
            sourcePath: relativePath,
            expectedValue:
              '/* @lifecycle ACTIVE — <reason> */ or // @lifecycle ACTIVE — <reason>',
            actualValue: 'No lifecycle declaration found',
          });
        }
      } catch {
        // Skip files we cannot read
      }
    }

    return results;
  }

  /**
   * Check for `any` type usage in source files (Constitution §4).
   * Skips test files, comments, and type definition files.
   */
  private async checkAnyTypes(
    files: string[],
  ): Promise<DriftDetectionResult[]> {
    const results: DriftDetectionResult[] = [];
    // Matches `: any` but not inside comments or string literals
    const anyPattern = /:\s*any\b/;

    for (const file of files) {
      // Skip .d.ts files — they often contain `any` legitimately
      if (file.endsWith('.d.ts')) continue;

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        const violatingLines: number[] = [];

        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          // Skip comments
          if (
            trimmed.startsWith('//') ||
            trimmed.startsWith('*') ||
            trimmed.startsWith('/*')
          ) {
            continue;
          }
          if (anyPattern.test(lines[i])) {
            violatingLines.push(i + 1);
          }
        }

        if (violatingLines.length > 0) {
          const relativePath = path.relative(process.cwd(), file);
          const lineSummary = violatingLines
            .slice(0, 10)
            .join(', ')
            .concat(violatingLines.length > 10 ? `, ...` : '');
          results.push({
            detectorType: DetectorType.POLICY,
            severity: Severity.HIGH,
            title: '`any` type usage detected',
            description: `File ${relativePath} uses \`any\` type on lines: ${lineSummary} (${violatingLines.length} total). Use \`unknown\` with type guards per Constitution §4.`,
            sourcePath: relativePath,
            expectedValue: 'No `any` types — use `unknown` with type guards',
            actualValue: `${violatingLines.length} occurrence(s) of \`any\` type`,
          });
        }
      } catch {
        // Skip files we cannot read
      }
    }

    return results;
  }

  /**
   * Check for console.log/error/warn/debug in production code (Constitution §4).
   * NestJS Logger should be used instead.
   */
  private async checkConsoleUsage(
    files: string[],
  ): Promise<DriftDetectionResult[]> {
    const results: DriftDetectionResult[] = [];
    const consolePattern = /console\.(log|warn|error|debug)\(/;

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        const violatingLines: number[] = [];

        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (trimmed.startsWith('//')) continue;
          if (consolePattern.test(lines[i])) {
            violatingLines.push(i + 1);
          }
        }

        if (violatingLines.length > 0) {
          const relativePath = path.relative(process.cwd(), file);
          const lineSummary = violatingLines
            .slice(0, 10)
            .join(', ')
            .concat(violatingLines.length > 10 ? `, ...` : '');
          results.push({
            detectorType: DetectorType.POLICY,
            severity: Severity.MEDIUM,
            title: 'console.* usage in production code',
            description: `File ${relativePath} uses console methods on lines: ${lineSummary} (${violatingLines.length} total). Use NestJS Logger instead per Constitution §4.`,
            sourcePath: relativePath,
            expectedValue: 'NestJS Logger for all logging',
            actualValue: `${violatingLines.length} occurrence(s) of console.*`,
          });
        }
      } catch {
        // Skip files we cannot read
      }
    }

    return results;
  }

  /**
   * Recursively count TypeScript source files in a directory.
   */
  private async countSourceFiles(dirPath: string): Promise<number> {
    try {
      let count = 0;
      const walk = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('__') && entry.name !== 'node_modules') {
              await walk(fullPath);
            }
          } else if (entry.isFile() && entry.name.endsWith('.ts')) {
            count++;
          }
        }
      };
      await walk(dirPath);
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Map a Prisma DriftEvent to the API response shape.
   */
  private mapToResponse(event: {
    id: string;
    detectorType: string;
    severity: string;
    title: string;
    description: string;
    sourcePath: string | null;
    expectedValue: string | null;
    actualValue: string | null;
    isResolved: boolean;
    resolvedAt: Date | null;
    detectedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): DriftEventResponse {
    return {
      id: event.id,
      detectorType: event.detectorType as DetectorType,
      severity: event.severity as Severity,
      title: event.title,
      description: event.description,
      sourcePath: event.sourcePath,
      expectedValue: event.expectedValue,
      actualValue: event.actualValue,
      isResolved: event.isResolved,
      resolvedAt: event.resolvedAt?.toISOString() ?? null,
      detectedAt: event.detectedAt.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}
