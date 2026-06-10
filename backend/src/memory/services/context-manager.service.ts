/* @lifecycle ACTIVE — Multi-source context assembly service (ADR-012) */

import {
  Injectable,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { $Enums } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { KnowledgeGraphService } from '../../knowledge/services/knowledge-graph.service';
import {
  AssembledContext,
  ContextFragment,
  ContextTier,
  TIER_BUDGETS,
} from '../interfaces/context-manager.interface';
import { AssembleContextDto } from '../dto/assemble-context.dto';
import * as fs from 'fs/promises';
import * as path from 'path';

/** Rough character-to-token ratio for content estimation. */
const CHARS_PER_TOKEN = 4;

@Injectable()
export class ContextManagerService {
  private readonly logger = new Logger(ContextManagerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Optional()
    private readonly knowledgeGraphService?: KnowledgeGraphService,
  ) {}

  /**
   * Assemble context from up to four sources based on the requested tier.
   * Results are cached in-memory for 5 minutes keyed by agentType:taskType:sessionId.
   */
  async assemble(dto: AssembleContextDto): Promise<AssembledContext> {
    const agentType = dto.agentType;
    const taskType = dto.taskType;
    const tier = dto.tier ?? ContextTier.TIER_1;
    const sessionId = dto.sessionId ?? `session-${Date.now()}`;
    const budget = TIER_BUDGETS[tier];

    // Check cache
    const cacheKey = `context:${agentType}:${taskType}:${sessionId}`;
    const cached = await this.cacheManager.get<AssembledContext>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // Assemble fragments from enabled tiers
    const fragments: ContextFragment[] = [];
    let usedTokens = 0;
    let truncated = false;

    // Tier 1: Agent memories (always included)
    const memoryFragments = await this.loadAgentMemories(agentType, taskType);
    for (const f of memoryFragments) {
      if (usedTokens + f.tokenEstimate <= budget) {
        fragments.push(f);
        usedTokens += f.tokenEstimate;
      } else {
        truncated = true;
        break;
      }
    }

    // Tier 2: Knowledge Graph (if available)
    if (!truncated && (tier === ContextTier.TIER_2 || tier === ContextTier.TIER_3)) {
      const kgFragments = await this.loadKnowledgeGraph(taskType);
      for (const f of kgFragments) {
        if (usedTokens + f.tokenEstimate <= budget) {
          fragments.push(f);
          usedTokens += f.tokenEstimate;
        } else {
          truncated = true;
          break;
        }
      }
    }

    // Tier 3: Rules + ADRs
    if (!truncated && tier === ContextTier.TIER_3) {
      const rulesFragments = await this.loadRules();
      for (const f of rulesFragments) {
        if (usedTokens + f.tokenEstimate <= budget) {
          fragments.push(f);
          usedTokens += f.tokenEstimate;
        } else {
          truncated = true;
          break;
        }
      }

      if (!truncated) {
        const archFragments = await this.loadArchitectureDocs();
        for (const f of archFragments) {
          if (usedTokens + f.tokenEstimate <= budget) {
            fragments.push(f);
            usedTokens += f.tokenEstimate;
          } else {
            truncated = true;
            break;
          }
        }
      }
    }

    // Combine all fragments into a single markdown string
    const combined = this.combineFragments(fragments);

    const result: AssembledContext = {
      sessionId,
      agentType,
      taskType,
      tier,
      fragments,
      combined,
      totalTokens: usedTokens,
      budget,
      truncated,
      assembledAt: new Date().toISOString(),
    };

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, result, 300_000);
    this.logger.log(
      `Assembled ${tier} context for ${agentType}/${taskType}: ${usedTokens}/${budget} tokens, ${fragments.length} fragments`,
    );

    return result;
  }

  // ─── Source: Agent Memories ──────────────────────────────────────────

  private async loadAgentMemories(
    agentType: string,
    taskType: string,
  ): Promise<ContextFragment[]> {
    const memories = await this.prisma.agentMemory.findMany({
      where: {
        agentType: agentType as unknown as $Enums.AgentType,
        taskType,
        expiresAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (memories.length === 0) {
      return [];
    }

    const lines: string[] = [];
    for (const m of memories) {
      lines.push(`- [${m.outcome}] ${m.taskType} (${m.agentType})`);
      if (m.lessonsLearned && m.lessonsLearned.length > 0) {
        lines.push(`  Lessons: ${m.lessonsLearned.join('; ')}`);
      }
      if (m.decision) {
        lines.push(`  Decision: ${m.decision}`);
      }
    }

    const content = lines.join('\n');
    return [
      {
        source: 'agent_memory',
        title: `Agent Memories (${memories.length})`,
        content,
        tokenEstimate: this.estimateTokens(content),
      },
    ];
  }

  // ─── Source: Knowledge Graph ─────────────────────────────────────────

  private async loadKnowledgeGraph(
    taskType: string,
  ): Promise<ContextFragment[]> {
    if (!this.knowledgeGraphService) {
      return [];
    }

    try {
      // Find nodes related to the task module
      const moduleName = this.mapTaskTypeToModule(taskType);
      const { items } = await this.knowledgeGraphService.findNodes({
        module: moduleName,
        take: 30,
      });

      if (items.length === 0) {
        return [];
      }

      const lines: string[] = [];
      for (const node of items) {
        lines.push(`- **${node.label}** (${node.type})`);
        if (node.description) {
          lines.push(`  ${node.description}`);
        }
      }

      const content = lines.join('\n');
      return [
        {
          source: 'knowledge_graph',
          title: `Knowledge Graph Nodes (${items.length})`,
          content,
          tokenEstimate: this.estimateTokens(content),
        },
      ];
    } catch (error) {
      this.logger.warn(
        `Knowledge Graph query failed: ${(error as Error).message}`,
      );
      return [];
    }
  }

  // ─── Source: Rule Files ──────────────────────────────────────────────

  private async loadRules(): Promise<ContextFragment[]> {
    // Define priority rule files to include (Constitution, core ADRs, System Contracts)
    const ruleFiles = [
      { relPath: 'docs/constitution.md', label: 'Constitution' },
      { relPath: 'docs/decisions/008-lifecycle-declarations.md', label: 'ADR-008: Lifecycle' },
      { relPath: 'docs/architecture.md', label: 'Architecture' },
    ];

    const fragments: ContextFragment[] = [];
    const root = path.resolve(process.cwd(), '..');

    for (const file of ruleFiles) {
      try {
        const fullPath = path.join(root, file.relPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const shortContent = this.summarizeLongFile(file.label, content);
        fragments.push({
          source: 'rules',
          title: file.label,
          content: shortContent,
          tokenEstimate: this.estimateTokens(shortContent),
        });
      } catch {
        this.logger.warn(`Could not read rule file: ${file.relPath}`);
      }
    }

    return fragments;
  }

  // ─── Source: Architecture Docs ───────────────────────────────────────

  private async loadArchitectureDocs(): Promise<ContextFragment[]> {
    const fragments: ContextFragment[] = [];

    const archFiles = [
      { relPath: 'docs/decisions/index.md', label: 'ADR Index' },
      { relPath: 'docs/system-specification.md', label: 'System Specification' },
    ];

    const root = path.resolve(process.cwd(), '..');

    for (const file of archFiles) {
      try {
        const fullPath = path.join(root, file.relPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const shortContent = this.summarizeLongFile(file.label, content);
        fragments.push({
          source: 'architecture',
          title: file.label,
          content: shortContent,
          tokenEstimate: this.estimateTokens(shortContent),
        });
      } catch {
        this.logger.warn(`Could not read architecture doc: ${file.relPath}`);
      }
    }

    return fragments;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  /**
   * Combine fragments into a single markdown string with source headers.
   */
  private combineFragments(fragments: ContextFragment[]): string {
    const parts: string[] = [];
    for (const f of fragments) {
      parts.push(`## Source: ${f.title}\n${f.content}\n`);
    }
    return parts.join('\n');
  }

  /**
   * Estimate token count from character count.
   * Ratio: ~4 characters per token (English text average).
   */
  private estimateTokens(content: string): number {
    return Math.ceil(content.length / CHARS_PER_TOKEN);
  }

  /**
   * Summarize a long file by returning only key sections.
   * For large files (>2000 chars), include up to first 1000 chars
   * plus section headings from the rest.
   */
  private summarizeLongFile(label: string, content: string): string {
    if (content.length <= 2000) {
      return content;
    }

    const lines = content.split('\n');
    const head = lines.slice(0, 20).join('\n');
    const headings = lines
      .filter((l) => l.trim().startsWith('##') || l.trim().startsWith('###'))
      .slice(0, 15)
      .join('\n');

    return `${head}\n\n... (${label} truncated, ${content.length} chars total)\n\n### Key Sections\n${headings}`;
  }

  /**
   * Map a task type string to a knowledge-graph module name.
   * e.g. "LEVEL_2:evaluation" -> "evaluation", "LEVEL_1:auth" -> "auth"
   *
   * Behavioral invariant: returns IDENTICAL strings to the legacy
   * inferModuleFromTask for all existing taskType inputs.
   * Module-qualified types (LEVEL_2:evaluation) bind via SystemModule;
   * legacy tokens (LEVEL_1, LEVEL_3) preserve their ontology-distinct mappings.
   */
  private mapTaskTypeToModule(taskType: string): string {
    const parts = taskType.split(':');
    if (parts.length >= 2) {
      return parts[1];
    }
    // Legacy routing tokens — ontologically distinct from SystemModule
    const known: Record<string, string> = {
      LEVEL_1: 'shared',
      LEVEL_2: 'evaluation',
      LEVEL_3: 'architecture',
    };
    return known[taskType] ?? 'shared';
  }
}
