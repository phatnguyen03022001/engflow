/* @lifecycle ACTIVE — Knowledge Graph REST controller */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { KnowledgeGraphService } from './services/knowledge-graph.service';
import { KnowledgeSyncService } from './services/knowledge-sync.service';
import { CreateNodeDto } from './dto/create-node.dto';
import { CreateEdgeDto } from './dto/create-edge.dto';
import {
  QueryNodesDto,
  QueryEdgesDto,
} from './dto/query-graph.dto';

@ApiTags('Knowledge Graph')
@ApiBearerAuth('JWT-auth')
@Controller('knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KnowledgeController {
  constructor(
    private readonly graphService: KnowledgeGraphService,
    private readonly syncService: KnowledgeSyncService,
  ) {}

  // ─── Nodes ───────────────────────────────────────────────────────────────

  @Post('nodes')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a knowledge node' })
  createNode(@Body() dto: CreateNodeDto) {
    return this.graphService.createNode(dto);
  }

  @Get('nodes')
  @ApiOperation({ summary: 'List knowledge nodes with optional filters' })
  findNodes(@Query() query: QueryNodesDto) {
    return this.graphService.findNodes(query);
  }

  @Get('nodes/:nodeId')
  @ApiOperation({ summary: 'Get a knowledge node by nodeId with edges' })
  findNode(@Param('nodeId') nodeId: string) {
    return this.graphService.findNodeByNodeId(nodeId);
  }

  @Patch('nodes/:nodeId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a knowledge node' })
  updateNode(
    @Param('nodeId') nodeId: string,
    @Body() dto: Partial<CreateNodeDto>,
  ) {
    return this.graphService.updateNode(nodeId, dto);
  }

  @Delete('nodes/:nodeId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft-deactivate a knowledge node' })
  deactivateNode(@Param('nodeId') nodeId: string) {
    return this.graphService.deactivateNode(nodeId);
  }

  // ─── Edges ───────────────────────────────────────────────────────────────

  @Post('edges')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a knowledge edge' })
  createEdge(@Body() dto: CreateEdgeDto) {
    return this.graphService.createEdge(dto);
  }

  @Get('edges')
  @ApiOperation({ summary: 'List knowledge edges with optional filters' })
  findEdges(@Query() query: QueryEdgesDto) {
    return this.graphService.findEdges(query);
  }

  @Delete('edges/:edgeId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a knowledge edge' })
  deleteEdge(@Param('edgeId') edgeId: string) {
    return this.graphService.deleteEdge(edgeId);
  }

  // ─── Graph Query ─────────────────────────────────────────────────────────

  @Get('graph/query')
  @ApiOperation({ summary: 'Query graph — impact analysis from a node' })
  queryImpact(
    @Query('nodeId') nodeId: string,
    @Query('depth') depth?: string,
  ) {
    const parsedDepth = depth ? parseInt(depth, 10) : 3;
    return this.graphService.queryImpact(nodeId, parsedDepth);
  }

  @Get('graph/impact')
  @ApiOperation({ summary: 'Impact analysis - find all affected nodes by depth' })
  queryImpactByDepth(
    @Query('nodeId') nodeId: string,
    @Query('depth') depth?: string,
  ) {
    const parsedDepth = depth ? parseInt(depth, 10) : 3;
    return this.graphService.queryImpact(nodeId, parsedDepth);
  }

  @Get('graph/trace')
  @ApiOperation({ summary: 'Path trace between two nodes' })
  queryPath(
    @Query('fromNodeId') fromNodeId: string,
    @Query('toNodeId') toNodeId: string,
  ) {
    return this.graphService.queryPath(fromNodeId, toNodeId);
  }

  @Get('graph/neighbors')
  @ApiOperation({ summary: 'Get neighbors (incoming + outgoing) of a node' })
  queryNeighbors(
    @Query('nodeId') nodeId: string,
    @Query('edgeType') edgeType?: string,
  ) {
    return this.graphService.queryNeighbors(nodeId, edgeType);
  }

  // ─── Sync ────────────────────────────────────────────────────────────────

  @Post('sync')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Trigger manual knowledge graph sync from file scan' })
  triggerSync() {
    return this.syncService.syncFromFileScan();
  }
}
