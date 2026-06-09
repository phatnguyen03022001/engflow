// @lifecycle TEMPORARY — Seed script for model registry (ADR-010)
// Run: npx ts-node prisma/seed-model-registry.ts

import { PrismaClient, ModelTier, ModelCapability } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding model registry data...\n');

  // ─── Provider: DeepSeek ──────────────────────────────────────────────────

  const deepseekProviderId = 'deepseek';

  const existingProvider = await prisma.modelProvider.findUnique({
    where: { providerId: deepseekProviderId },
  });

  if (!existingProvider) {
    await prisma.modelProvider.create({
      data: {
        providerId: deepseekProviderId,
        name: 'DeepSeek',
        apiBaseUrl: 'https://api.deepseek.com/v1',
        apiKeyEnv: 'DEEPSEEK_API_KEY',
        isActive: true,
      },
    });
    console.log('  ✅ Provider "DeepSeek" created');
  } else {
    console.log('  ⏭️  Provider "DeepSeek" already exists, skipping');
  }

  // ─── Models ──────────────────────────────────────────────────────────────

  const models = [
    {
      modelId: 'deepseek/deepseek-v4-flash',
      providerId: deepseekProviderId,
      displayName: 'DeepSeek v4 Flash',
      tier: ModelTier.BUDGET,
      capabilities: [ModelCapability.CHAT, ModelCapability.JSON_MODE, ModelCapability.REASONING, ModelCapability.TOOL_USE],
      contextWindow: 128000,
      maxOutputTokens: 8192,
      costPer1kInput: 0.14,
      costPer1kOutput: 0.28,
      isActive: true,
    },
    {
      modelId: 'deepseek/deepseek-v4-pro',
      providerId: deepseekProviderId,
      displayName: 'DeepSeek v4 Pro',
      tier: ModelTier.PREMIUM,
      capabilities: [ModelCapability.CHAT, ModelCapability.JSON_MODE, ModelCapability.FUNCTION_CALLING, ModelCapability.REASONING, ModelCapability.TOOL_USE, ModelCapability.VISION],
      contextWindow: 128000,
      maxOutputTokens: 8192,
      costPer1kInput: 0.89,
      costPer1kOutput: 1.79,
      isActive: true,
    },
  ];

  for (const model of models) {
    const existingModel = await prisma.modelRegistry.findUnique({
      where: { modelId: model.modelId },
    });

    if (existingModel) {
      console.log(`  ⏭️  Model "${model.modelId}" already exists, skipping`);
      continue;
    }

    await prisma.modelRegistry.create({ data: model });
    console.log(`  ✅ Model "${model.modelId}" created`);
  }

  // ─── Routes ──────────────────────────────────────────────────────────────

  const routes = [
    // Default: all agent types use flash (priority 0)
    { routeId: 'route-router-level1', agentType: 'ROUTER', taskType: 'LEVEL_1', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
    { routeId: 'route-router-level2', agentType: 'ROUTER', taskType: 'LEVEL_2', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
    { routeId: 'route-router-level3', agentType: 'ROUTER', taskType: 'LEVEL_3', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
    { routeId: 'route-plan-level2', agentType: 'PLAN', taskType: 'LEVEL_2', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
    { routeId: 'route-plan-level3', agentType: 'PLAN', taskType: 'LEVEL_3', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
    { routeId: 'route-architect-level3', agentType: 'ARCHITECT', taskType: 'LEVEL_3', primaryModelId: 'deepseek/deepseek-v4-pro', priority: 0 },
    { routeId: 'route-code-level1', agentType: 'CODE', taskType: 'LEVEL_1', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
    { routeId: 'route-code-level2', agentType: 'CODE', taskType: 'LEVEL_2', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
    { routeId: 'route-code-level3', agentType: 'CODE', taskType: 'LEVEL_3', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
    { routeId: 'route-preverify-level1', agentType: 'PRE_VERIFY', taskType: 'LEVEL_1', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
    { routeId: 'route-preverify-level2', agentType: 'PRE_VERIFY', taskType: 'LEVEL_2', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
    { routeId: 'route-preverify-level3', agentType: 'PRE_VERIFY', taskType: 'LEVEL_3', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
    { routeId: 'route-postverify-level1', agentType: 'POST_VERIFY', taskType: 'LEVEL_1', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
    { routeId: 'route-postverify-level2', agentType: 'POST_VERIFY', taskType: 'LEVEL_2', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
    { routeId: 'route-postverify-level3', agentType: 'POST_VERIFY', taskType: 'LEVEL_3', primaryModelId: 'deepseek/deepseek-v4-flash', priority: 0 },
  ];

  for (const route of routes) {
    const existingRoute = await prisma.modelRoute.findUnique({
      where: { routeId: route.routeId },
    });

    if (existingRoute) {
      console.log(`  ⏭️  Route "${route.routeId}" already exists, skipping`);
      continue;
    }

    await prisma.modelRoute.create({ data: route });
    console.log(`  ✅ Route "${route.routeId}" created`);
  }

  // ─── Fallback Chains ─────────────────────────────────────────────────────

  const fallbackChains = [
    {
      chainId: 'fallback-flash-to-pro',
      primaryModelId: 'deepseek/deepseek-v4-flash',
      fallbackModelId: 'deepseek/deepseek-v4-pro',
      priority: 1,
      triggerOnHttpCode: 429,
      triggerOnTimeoutMs: 60000,
      maxRetries: 1,
      isActive: true,
    },
    {
      chainId: 'fallback-pro-to-flash',
      primaryModelId: 'deepseek/deepseek-v4-pro',
      fallbackModelId: 'deepseek/deepseek-v4-flash',
      priority: 1,
      triggerOnHttpCode: 429,
      triggerOnTimeoutMs: 60000,
      maxRetries: 1,
      isActive: true,
    },
    {
      chainId: 'fallback-flash-retry-pro',
      primaryModelId: 'deepseek/deepseek-v4-flash',
      fallbackModelId: 'deepseek/deepseek-v4-flash', // retry same model
      priority: 1,
      triggerOnHttpCode: 503,
      triggerOnTimeoutMs: 30000,
      maxRetries: 1,
      isActive: true,
    },
  ];

  for (const chain of fallbackChains) {
    const existingChain = await prisma.fallbackChain.findUnique({
      where: { chainId: chain.chainId },
    });

    if (existingChain) {
      console.log(`  ⏭️  Fallback chain "${chain.chainId}" already exists, skipping`);
      continue;
    }

    await prisma.fallbackChain.create({ data: chain });
    console.log(`  ✅ Fallback chain "${chain.chainId}" created`);
  }

  // Summary
  const providerCount = await prisma.modelProvider.count();
  const modelCount = await prisma.modelRegistry.count();
  const routeCount = await prisma.modelRoute.count();
  const chainCount = await prisma.fallbackChain.count();

  console.log(`\nDone. Summary:`);
  console.log(`  Providers:       ${providerCount}`);
  console.log(`  Models:          ${modelCount}`);
  console.log(`  Routes:          ${routeCount}`);
  console.log(`  Fallback Chains: ${chainCount}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
