/* @lifecycle ACTIVE — Service for scanning and seeding knowledge graph nodes */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SyncResult } from '../interfaces/knowledge.interface';

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
      // 1. Scan backend/src/ directories → ARCHITECTURE nodes
      await this.scanSourceModules(result);
      // 2. Scan docs/decisions/ → DECISION nodes
      await this.scanDecisionFiles(result);
      // 3. Scan schema.prisma → CODE nodes
      await this.scanPrismaModels(result);
    } catch (error) {
      this.logger.error(`Sync failed: ${(error as Error).message}`);
      result.errors.push((error as Error).message);
    }

    this.logger.log(
      `Sync complete: ${result.nodesCreated} nodes, ${result.edgesCreated} edges created`,
    );
    return result;
  }

  private async scanSourceModules(result: SyncResult): Promise<void> {
    const srcPath = path.resolve('backend/src');
    let entries: string[];
    try {
      entries = await fs.readdir(srcPath);
    } catch (err) {
      this.logger.warn(`Cannot read source directory: ${srcPath} (${(err as Error).message})`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(srcPath, entry);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          const nodeId = `mod-${entry}`;
          const created = await this.upsertNode({
            nodeId,
            type: 'ARCHITECTURE',
            label: `${entry.charAt(0).toUpperCase() + entry.slice(1)} Module`,
            module: entry,
            sourceFile: `backend/src/${entry}/`,
          });
          if (created) result.nodesCreated++;
        }
      } catch {
        // skip entries that can't be stat'd
      }
    }
  }

  private async scanDecisionFiles(result: SyncResult): Promise<void> {
    const decisionsPath = path.resolve('docs/decisions');
    let files: string[];
    try {
      files = await fs.readdir(decisionsPath);
    } catch (err) {
      this.logger.warn(`Cannot read decisions directory: ${decisionsPath} (${(err as Error).message})`);
      return;
    }

    for (const file of files) {
      if (file.endsWith('.md') && !file.includes('index')) {
        const nodeId = file.replace('.md', '');
        const created = await this.upsertNode({
          nodeId,
          type: 'DECISION',
          label: file,
          module: 'core',
          sourceFile: `docs/decisions/${file}`,
        });
        if (created) result.nodesCreated++;
      }
    }
  }

  private async scanPrismaModels(result: SyncResult): Promise<void> {
    const schemaPath = path.resolve('backend/prisma/schema.prisma');
    let schema: string;
    try {
      schema = await fs.readFile(schemaPath, 'utf-8');
    } catch (err) {
      this.logger.warn(`Cannot read schema file: ${schemaPath} (${(err as Error).message})`);
      return;
    }

    const modelRegex = /^model (\w+) \{/gm;
    let match: RegExpExecArray | null;
    while ((match = modelRegex.exec(schema)) !== null) {
      const modelName = match[1];
      const nodeId = `model:${modelName}`;
      const created = await this.upsertNode({
        nodeId,
        type: 'CODE',
        label: modelName,
        module: 'prisma',
        sourceFile: 'backend/prisma/schema.prisma',
      });
      if (created) result.nodesCreated++;
    }
  }

  /**
   * Upsert a knowledge node: create if not exists, update if exists.
   * Returns true if a new node was created, false if updated.
   */
  private async upsertNode(data: {
    nodeId: string;
    type: string;
    label: string;
    module?: string;
    sourceFile?: string;
  }): Promise<boolean> {
    const existing = await this.prisma.knowledgeNode.findUnique({
      where: { nodeId: data.nodeId },
    });

    if (existing) {
      await this.prisma.knowledgeNode.update({
        where: { nodeId: data.nodeId },
        data: {
          type: data.type as any,
          label: data.label,
          module: data.module ?? null,
          sourceFile: data.sourceFile ?? null,
        },
      });
      return false;
    }

    await this.prisma.knowledgeNode.create({
      data: {
        nodeId: data.nodeId,
        type: data.type as any,
        label: data.label,
        module: data.module ?? null,
        sourceFile: data.sourceFile ?? null,
        isActive: true,
      },
    });
    return true;
  }
}
