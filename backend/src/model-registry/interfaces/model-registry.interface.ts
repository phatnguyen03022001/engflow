/* @lifecycle ACTIVE — Model registry TypeScript interfaces and enums (ADR-010) */

export enum ModelTier {
  FREE = 'FREE',
  BUDGET = 'BUDGET',
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM',
  EXPERIMENTAL = 'EXPERIMENTAL',
}

export enum ModelCapability {
  CHAT = 'CHAT',
  JSON_MODE = 'JSON_MODE',
  FUNCTION_CALLING = 'FUNCTION_CALLING',
  VISION = 'VISION',
  TOOL_USE = 'TOOL_USE',
  REASONING = 'REASONING',
}

export interface ModelProviderEntry {
  providerId: string;
  name: string;
  apiBaseUrl: string;
  apiKeyEnv: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelRegistryEntry {
  modelId: string;
  providerId: string;
  displayName: string;
  tier: ModelTier;
  capabilities: ModelCapability[];
  contextWindow: number;
  maxOutputTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  avgLatencyMs: number | null;
  successRate: number | null;
  qualityScore: number | null;
  isActive: boolean;
  deprecatedAt: Date | null;
  replacedByModelId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelRouteEntry {
  routeId: string;
  agentType: string;
  taskType: string;
  primaryModelId: string;
  priority: number;
  maxCostUsd: number | null;
  maxLatencyMs: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FallbackChainEntry {
  chainId: string;
  primaryModelId: string;
  fallbackModelId: string;
  priority: number;
  triggerOnHttpCode: number | null;
  triggerOnTimeoutMs: number | null;
  maxRetries: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResolvedModel {
  modelId: string;
  displayName: string;
  providerId: string;
  tier: ModelTier;
}

export interface FallbackStep {
  chainId: string;
  model: ResolvedModel;
  priority: number;
  triggerOnHttpCode: number | null;
  triggerOnTimeoutMs: number | null;
  maxRetries: number;
}
