-- CreateTable
CREATE TABLE "agent_executions" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "request_summary" TEXT NOT NULL,
    "router_route" TEXT NOT NULL,
    "router_confidence" DOUBLE PRECISION NOT NULL,
    "router_risk" TEXT NOT NULL,
    "router_reason" TEXT NOT NULL,
    "plan_summary" TEXT,
    "plan_task_count" INTEGER,
    "arch_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "arch_revision_needed" BOOLEAN NOT NULL DEFAULT false,
    "pre_verify_decision" TEXT,
    "pre_verify_flags" JSONB,
    "code_attempts" INTEGER NOT NULL DEFAULT 0,
    "code_first_attempt_success" BOOLEAN,
    "post_verify_decision" TEXT,
    "post_verify_issues" JSONB,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "debug_success" BOOLEAN,
    "final_outcome" TEXT NOT NULL,
    "total_duration_ms" INTEGER,
    "committed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_phases" (
    "id" TEXT NOT NULL,
    "phase_id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "phase_order" INTEGER NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "decision" TEXT,
    "decision_reason" TEXT,
    "duration_ms" INTEGER,
    "model_used" TEXT,
    "transitioned_to" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_metrics" (
    "id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "metric_name" TEXT NOT NULL,
    "metric_value" DOUBLE PRECISION NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "confidence_interval_low" DOUBLE PRECISION,
    "confidence_interval_high" DOUBLE PRECISION,
    "window" TEXT NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_dimensions" (
    "id" TEXT NOT NULL,
    "metric_id" TEXT NOT NULL,
    "dimension_key" TEXT NOT NULL,
    "dimension_value" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "metric_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_executions_execution_id_key" ON "agent_executions"("execution_id");

-- CreateIndex
CREATE INDEX "agent_executions_final_outcome_idx" ON "agent_executions"("final_outcome");

-- CreateIndex
CREATE INDEX "agent_executions_router_route_idx" ON "agent_executions"("router_route");

-- CreateIndex
CREATE INDEX "agent_executions_created_at_idx" ON "agent_executions"("created_at");

-- CreateIndex
CREATE INDEX "agent_executions_router_route_final_outcome_idx" ON "agent_executions"("router_route", "final_outcome");

-- CreateIndex
CREATE UNIQUE INDEX "execution_phases_phase_id_key" ON "execution_phases"("phase_id");

-- CreateIndex
CREATE INDEX "execution_phases_execution_id_idx" ON "execution_phases"("execution_id");

-- CreateIndex
CREATE INDEX "execution_phases_agent_type_idx" ON "execution_phases"("agent_type");

-- CreateIndex
CREATE INDEX "execution_phases_execution_id_phase_order_idx" ON "execution_phases"("execution_id", "phase_order");

-- CreateIndex
CREATE INDEX "agent_metrics_agent_type_idx" ON "agent_metrics"("agent_type");

-- CreateIndex
CREATE INDEX "agent_metrics_computed_at_idx" ON "agent_metrics"("computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_metrics_agent_type_metric_name_window_computed_at_key" ON "agent_metrics"("agent_type", "metric_name", "window", "computed_at");

-- CreateIndex
CREATE INDEX "metric_dimensions_metric_id_idx" ON "metric_dimensions"("metric_id");

-- CreateIndex
CREATE INDEX "metric_dimensions_metric_id_dimension_key_dimension_value_idx" ON "metric_dimensions"("metric_id", "dimension_key", "dimension_value");

-- AddForeignKey
ALTER TABLE "execution_phases" ADD CONSTRAINT "execution_phases_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "agent_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_dimensions" ADD CONSTRAINT "metric_dimensions_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "agent_metrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
