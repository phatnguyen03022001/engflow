/* @lifecycle ACTIVE — Model registry REST controller (ADR-010) */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RegistryService } from './services/registry.service';
import { RouterService } from './services/router.service';
import { CostTrackerService } from './services/cost-tracker.service';
import { FallbackService } from './services/fallback.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { CreateModelDto } from './dto/create-model.dto';
import { CreateRouteDto } from './dto/create-route.dto';
import { CreateFallbackChainDto } from './dto/create-fallback-chain.dto';
import { CreateCostLogDto } from './dto/create-cost-log.dto';
import { ModelRouteQueryDto } from './dto/model-route-query.dto';
import { CostReportQueryDto } from './dto/cost-report-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Model Registry')
@Controller('model-registry')
export class ModelRegistryController {
  constructor(
    private readonly registryService: RegistryService,
    private readonly routerService: RouterService,
    private readonly costTrackerService: CostTrackerService,
    private readonly fallbackService: FallbackService,
  ) {}

  // ─── Agent API Key authentication helper ─────────────────────────────────

  private validateAgentApiKey(apiKey: string): void {
    const expectedKey = process.env.AGENT_API_KEY || 'agent-dev-key';
    if (apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing agent API key');
    }
  }

  // ==========================================================================
  // PROVIDERS (JWT ADMIN)
  // ==========================================================================

  @Post('providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Register a model provider' })
  createProvider(@Body() dto: CreateProviderDto) {
    return this.registryService.createProvider(dto);
  }

  @Get('providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List model providers' })
  getProviders(@Query('includeInactive') includeInactive?: string) {
    return this.registryService.getProviders(includeInactive === 'true');
  }

  // ==========================================================================
  // MODELS (JWT ADMIN)
  // ==========================================================================

  @Post('models')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Register a model in the registry' })
  createModel(@Body() dto: CreateModelDto) {
    return this.registryService.createModel(dto);
  }

  @Get('models')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List models with optional filters' })
  getModels(
    @Query('tier') tier?: string,
    @Query('providerId') providerId?: string,
    @Query('isActive') isActive?: string,
    @Query('capabilities') capabilities?: string,
  ) {
    return this.registryService.getModels({
      tier,
      providerId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      capabilities: capabilities ? capabilities.split(',') : undefined,
    });
  }

  @Get('models/:modelId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get model details' })
  getModel(@Param('modelId') modelId: string) {
    return this.registryService.getModel(modelId);
  }

  @Patch('models/:modelId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update model details' })
  updateModel(
    @Param('modelId') modelId: string,
    @Body() dto: Partial<CreateModelDto>,
  ) {
    return this.registryService.updateModel(modelId, dto);
  }

  @Delete('models/:modelId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Soft-deactivate a model' })
  deactivateModel(@Param('modelId') modelId: string) {
    return this.registryService.deactivateModel(modelId);
  }

  // ==========================================================================
  // ROUTES (JWT ADMIN + Agent API Key)
  // ==========================================================================

  @Post('routes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a routing rule' })
  createRoute(@Body() dto: CreateRouteDto) {
    return this.routerService.createRoute(dto);
  }

  @Get('routes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List routing rules' })
  getRoutes(
    @Query('agentType') agentType?: string,
    @Query('taskType') taskType?: string,
  ) {
    return this.routerService.getRoutes({ agentType, taskType });
  }

  @Get('route')
  @ApiOperation({ summary: 'Resolve model for (agentType, taskType) — agent API' })
  resolveRoute(
    @Headers('x-agent-api-key') apiKey: string,
    @Query() query: ModelRouteQueryDto,
  ) {
    this.validateAgentApiKey(apiKey);
    return this.routerService.resolveRoute(query.agentType, query.taskType);
  }

  // ==========================================================================
  // FALLBACK CHAINS (JWT ADMIN)
  // ==========================================================================

  @Post('fallback-chains')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a fallback chain' })
  createFallbackChain(@Body() dto: CreateFallbackChainDto) {
    return this.fallbackService.createFallbackChain(dto);
  }

  @Get('fallback-chains')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List fallback chains' })
  getFallbackChains(
    @Query('primaryModelId') primaryModelId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.fallbackService.getFallbackChains({
      primaryModelId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  // ==========================================================================
  // COST LOGS (Agent API Key)
  // ==========================================================================

  @Post('cost-logs')
  @ApiOperation({ summary: 'Record a cost log entry — agent API' })
  recordCostLog(
    @Headers('x-agent-api-key') apiKey: string,
    @Body() dto: CreateCostLogDto,
  ) {
    this.validateAgentApiKey(apiKey);
    return this.costTrackerService.recordCost(dto);
  }

  // ==========================================================================
  // COST REPORTS (JWT ADMIN)
  // ==========================================================================

  @Get('costs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get cost reports with aggregation' })
  getCostReport(@Query() query: CostReportQueryDto) {
    return this.costTrackerService.getCostReport(query);
  }

  @Get('costs/projection')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get projected monthly spend' })
  getProjection() {
    return this.costTrackerService.getProjectedMonthlySpend();
  }

  @Post('costs/recalculate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Force recomputation of cost totals' })
  recalculateCosts() {
    return this.costTrackerService.recalculate();
  }
}
