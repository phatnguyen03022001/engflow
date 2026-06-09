-- CreateEnum
CREATE TYPE "ModelTier" AS ENUM ('FREE', 'BUDGET', 'STANDARD', 'PREMIUM', 'EXPERIMENTAL');

-- CreateEnum
CREATE TYPE "ModelCapability" AS ENUM ('CHAT', 'JSON_MODE', 'FUNCTION_CALLING', 'VISION', 'TOOL_USE', 'REASONING');

-- CreateTable
CREATE TABLE "model_providers" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "api_base_url" TEXT NOT NULL,
    "api_key_env" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_registry" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "tier" "ModelTier" NOT NULL DEFAULT 'STANDARD',
    "capabilities" "ModelCapability"[],
    "context_window" INTEGER NOT NULL,
    "max_output_tokens" INTEGER NOT NULL DEFAULT 4096,
    "cost_per_1k_input" DOUBLE PRECISION NOT NULL,
    "cost_per_1k_output" DOUBLE PRECISION NOT NULL,
    "avg_latency_ms" INTEGER,
    "success_rate" DOUBLE PRECISION,
    "quality_score" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deprecated_at" TIMESTAMP(3),
    "replaced_by_model_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_routes" (
    "id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "primary_model_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "max_cost_usd" DOUBLE PRECISION,
    "max_latency_ms" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fallback_chains" (
    "id" TEXT NOT NULL,
    "chain_id" TEXT NOT NULL,
    "primary_model_id" TEXT NOT NULL,
    "fallback_model_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "trigger_on_http_code" INTEGER,
    "trigger_on_timeout_ms" INTEGER,
    "max_retries" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fallback_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_logs" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "phase_id" TEXT,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DOUBLE PRECISION NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "was_fallback" BOOLEAN NOT NULL DEFAULT false,
    "fallback_from" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "model_providers_provider_id_key" ON "model_providers"("provider_id");

-- CreateIndex
CREATE INDEX "model_providers_is_active_idx" ON "model_providers"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "model_registry_model_id_key" ON "model_registry"("model_id");

-- CreateIndex
CREATE INDEX "model_registry_tier_idx" ON "model_registry"("tier");

-- CreateIndex
CREATE INDEX "model_registry_is_active_idx" ON "model_registry"("is_active");

-- CreateIndex
CREATE INDEX "model_registry_provider_id_idx" ON "model_registry"("provider_id");

-- CreateIndex
CREATE INDEX "model_registry_tier_is_active_idx" ON "model_registry"("tier", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "model_routes_route_id_key" ON "model_routes"("route_id");

-- CreateIndex
CREATE INDEX "model_routes_agent_type_task_type_idx" ON "model_routes"("agent_type", "task_type");

-- CreateIndex
CREATE INDEX "model_routes_is_active_idx" ON "model_routes"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "model_routes_agent_type_task_type_priority_key" ON "model_routes"("agent_type", "task_type", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "fallback_chains_chain_id_key" ON "fallback_chains"("chain_id");

-- CreateIndex
CREATE INDEX "fallback_chains_primary_model_id_priority_idx" ON "fallback_chains"("primary_model_id", "priority");

-- CreateIndex
CREATE INDEX "fallback_chains_is_active_idx" ON "fallback_chains"("is_active");

-- CreateIndex
CREATE INDEX "fallback_chains_primary_model_id_fallback_model_id_idx" ON "fallback_chains"("primary_model_id", "fallback_model_id");

-- CreateIndex
CREATE INDEX "cost_logs_model_id_recorded_at_idx" ON "cost_logs"("model_id", "recorded_at");

-- CreateIndex
CREATE INDEX "cost_logs_execution_id_idx" ON "cost_logs"("execution_id");

-- CreateIndex
CREATE INDEX "cost_logs_recorded_at_idx" ON "cost_logs"("recorded_at");

-- CreateIndex
CREATE INDEX "cost_logs_execution_id_phase_id_idx" ON "cost_logs"("execution_id", "phase_id");

-- AddForeignKey
ALTER TABLE "model_registry" ADD CONSTRAINT "model_registry_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "model_providers"("provider_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_routes" ADD CONSTRAINT "model_routes_primary_model_id_fkey" FOREIGN KEY ("primary_model_id") REFERENCES "model_registry"("model_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fallback_chains" ADD CONSTRAINT "fallback_chains_primary_model_id_fkey" FOREIGN KEY ("primary_model_id") REFERENCES "model_registry"("model_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fallback_chains" ADD CONSTRAINT "fallback_chains_fallback_model_id_fkey" FOREIGN KEY ("fallback_model_id") REFERENCES "model_registry"("model_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_logs" ADD CONSTRAINT "cost_logs_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "model_registry"("model_id") ON DELETE RESTRICT ON UPDATE CASCADE;
