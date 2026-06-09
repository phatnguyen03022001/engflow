/* @lifecycle ACTIVE — Context retrieval REST controller (TASK-029) */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Headers,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { MemoryService } from './services/memory.service';
import { ContextManagerService } from './services/context-manager.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { QueryMemoryDto } from './dto/query-memory.dto';
import { TopPatternsDto } from './dto/top-patterns.dto';
import { AssembleContextDto } from './dto/assemble-context.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AgentType,
  PatternSummary,
  MemoryQueryResult,
} from './interfaces/agent-memory.interface';

@ApiTags('Memory')
@Controller('memories')
export class MemoryController {
  constructor(
    private readonly memoryService: MemoryService,
    private readonly contextManagerService: ContextManagerService,
  ) {}

  // ─── Static routes (must precede :id routes) ──────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Store a new agent memory entry' })
  createMemory(@Body() dto: CreateMemoryDto) {
    return this.memoryService.createMemory(dto);
  }

  @Get('similar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Query similar past memories by filters' })
  querySimilar(@Query() query: QueryMemoryDto) {
    let context: string | undefined;
    if (query.contextJson) {
      try {
        JSON.parse(query.contextJson);
        context = query.contextJson;
      } catch {
        // Invalid JSON passed as contextJson
      }
    }

    return this.memoryService.querySimilar({
      agentType: query.agentType,
      taskType: query.taskType,
      domain: query.domain,
      success: query.success,
      contextJson: context,
      minConfidence: query.minConfidence,
    });
  }

  @Get('patterns/successful')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get top successful agent patterns' })
  getSuccessfulPatterns(@Query() query: TopPatternsDto) {
    return this.memoryService.getTopPatterns(
      query.agentType,
      true,
      query.limit ?? 10,
    );
  }

  @Get('patterns/failed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get top failed agent patterns' })
  getFailedPatterns(@Query() query: TopPatternsDto) {
    return this.memoryService.getTopPatterns(
      query.agentType,
      false,
      query.limit ?? 10,
    );
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get memory summary statistics' })
  getSummary(@Query('agentType') agentType?: AgentType) {
    return this.memoryService.getSummary(agentType);
  }

  @Get('agent-context')
  @ApiOperation({ summary: 'Get agent context as markdown (internal API key auth)' })
  async getAgentContext(
    @Headers('x-agent-api-key') apiKey: string,
    @Query('agentType') agentType: string,
    @Query('taskType') taskType: string,
    @Query('limit') limit: string,
    @Query('includeFailed') includeFailed: string,
    @Res() res: Response,
  ) {
    // Authenticate via API key
    const expectedKey = process.env.AGENT_API_KEY || 'agent-dev-key';
    if (apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing agent API key');
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const shouldIncludeFailed = includeFailed !== 'false';
    const agentTypeEnum = agentType ? (agentType as AgentType) : undefined;

    // Query memory data
    const summary = await this.memoryService.getSummary(agentTypeEnum);
    const patternsSuccess = await this.memoryService.getTopPatterns(
      agentTypeEnum,
      true,
      parsedLimit,
    );
    const patternsFailed = shouldIncludeFailed
      ? await this.memoryService.getTopPatterns(agentTypeEnum, false, parsedLimit)
      : [];
    const similarParams: { agentType?: AgentType; taskType?: string } = {};
    if (agentTypeEnum) similarParams.agentType = agentTypeEnum;
    if (taskType) similarParams.taskType = taskType;
    const similar: MemoryQueryResult[] =
      Object.keys(similarParams).length > 0
        ? await this.memoryService.querySimilar(similarParams)
        : [];

    // Format markdown output
    let md = '## ℹ️ Agent Memory Context\n\n';
    md += '### Summary\n';
    md += `Total memories: ${summary.totalMemories} | Active: ${summary.activeMemories}\n\n`;

    if (patternsSuccess.length > 0) {
      md += '### Top Successful Patterns\n';
      md += '| Task Type | Success Rate | Count |\n|---|---|---|\n';
      patternsSuccess.forEach((p: PatternSummary) => {
        md += `| ${p.taskType} | ${p.successRate}% | ${p.totalCount} |\n`;
      });
      md += '\n';
    }

    if (patternsFailed.length > 0) {
      md += '### Top Failed Patterns\n';
      md += '| Task Type | Success Rate | Count |\n|---|---|---|\n';
      patternsFailed.forEach((p: PatternSummary) => {
        md += `| ${p.taskType} | ${p.successRate}% | ${p.totalCount} |\n`;
      });
      md += '\n';
    }

    if (similar.length > 0) {
      md += '### Similar Past Executions\n';
      similar.forEach((s: MemoryQueryResult) => {
        md += `- **${s.memory.taskType}** (${s.memory.agentType}) — applicability: ${s.applicabilityScore}\n`;
      });
      md += '\n';
    }

    if (summary.totalMemories === 0) {
      md += 'No memory data available for this context.\n';
    }

    res.set('Content-Type', 'text/plain').send(md);
  }

  // ─── Context Assembly (ADR-012) ────────────────────────────────────────

  @Post('context/assemble')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Assemble multi-source context for an agent task' })
  assembleContext(@Body() dto: AssembleContextDto) {
    return this.contextManagerService.assemble(dto);
  }

  @Post('from-execution/:executionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create memory entries from an execution trace' })
  createFromExecution(@Param('executionId') executionId: string) {
    return this.memoryService.createFromExecution(executionId);
  }
}
