-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'BEGINNER',
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "options" TEXT,
    "type" TEXT NOT NULL DEFAULT 'multiple_choice',
    "order" INTEGER NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_lessons" (
    "id" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "rec_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "decision_type" TEXT NOT NULL,
    "decision_domain" TEXT NOT NULL,
    "query_summary" TEXT NOT NULL,
    "project_id" TEXT,
    "constraints" TEXT[],
    "sources_consulted" TEXT[],
    "architecture_version" TEXT,
    "constitution_version" TEXT,
    "recommended_option" TEXT NOT NULL,
    "weighted_score" DOUBLE PRECISION NOT NULL,
    "score_margin" DOUBLE PRECISION NOT NULL,
    "justification" TEXT NOT NULL,
    "confidence_level" TEXT NOT NULL,
    "confidence_score" INTEGER NOT NULL,
    "ecs" DOUBLE PRECISION,
    "sqs" DOUBLE PRECISION,
    "cs" DOUBLE PRECISION,
    "unknowns_count" INTEGER,
    "unknowns_critical" INTEGER,
    "expected_outcome" TEXT,
    "debt_forecast" TEXT,
    "timeline_to_value" TEXT,
    "prerequisites" TEXT[],
    "when_to_revisit" TEXT,
    "tracking_status" TEXT NOT NULL DEFAULT 'PENDING',
    "final_outcome" TEXT,
    "assessed_at" TIMESTAMP(3),
    "implemented_option" TEXT,
    "regret_flag" BOOLEAN,
    "reversal_count" INTEGER NOT NULL DEFAULT 0,
    "reasoning_trace" TEXT,
    "advisory_report_ref" TEXT,
    "model_version" TEXT,
    "escalation_history" JSONB,
    "success_criteria" TEXT[],
    "predicted_risks" JSONB,
    "risk_mitigations" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_options" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "recommendation_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkpoints" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "checkpoint" TEXT NOT NULL,
    "evaluated_at" TIMESTAMP(3),
    "evaluator" TEXT NOT NULL DEFAULT 'ask',
    "evidence_sources" TEXT[],
    "was_implemented" BOOLEAN,
    "implemented_option" TEXT,
    "implementation_faith" TEXT,
    "divergence_reason" TEXT,
    "problem_solved" BOOLEAN,
    "solution_score" INTEGER,
    "debt_introduced" TEXT,
    "performance_impact" TEXT,
    "team_satisfaction" TEXT,
    "risks_materialized" JSONB,
    "risks_avoided" JSONB,
    "missed_risks" JSONB,
    "risk_assessment_acc" INTEGER,
    "forecast_accurate" BOOLEAN,
    "forecast_deviation" TEXT,
    "timeline_accurate" BOOLEAN,
    "was_replaced" BOOLEAN,
    "replacement_reason" TEXT,
    "was_reversed_by_adr" BOOLEAN,
    "checkpoint_verdict" TEXT,
    "verdict_confidence" TEXT,
    "notes" TEXT,
    "schedule_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_memories" (
    "id" TEXT NOT NULL,
    "memory_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "project_id" TEXT NOT NULL DEFAULT '__global__',
    "recommendation_id" TEXT,
    "outcome" TEXT NOT NULL,
    "solution_score" INTEGER,
    "context_factors" JSONB,
    "success_factors" TEXT[],
    "failure_factors" TEXT[],
    "applicability_score" DOUBLE PRECISION,
    "reference_count" INTEGER NOT NULL DEFAULT 0,
    "decay_weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_referenced_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "decision_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_scores" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "domain" TEXT,
    "decision_type" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "prior_alpha" INTEGER NOT NULL,
    "prior_beta" INTEGER NOT NULL,
    "last_outcome_at" TIMESTAMP(3),
    "decayed_at" TIMESTAMP(3),
    "next_recalculation" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trust_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accuracy_snapshots" (
    "id" TEXT NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_recommendations" INTEGER NOT NULL,
    "total_assessed" INTEGER NOT NULL,
    "overall_accuracy" DOUBLE PRECISION,
    "weighted_accuracy" DOUBLE PRECISION,
    "brier_score" DOUBLE PRECISION,
    "confidence_calibration" JSONB,
    "false_positive_rate" DOUBLE PRECISION,
    "false_negative_rate" DOUBLE PRECISION,
    "regret_rate" DOUBLE PRECISION,
    "reversal_rate" DOUBLE PRECISION,
    "forecast_accuracy" DOUBLE PRECISION,
    "implementation_rate" DOUBLE PRECISION,
    "trend" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accuracy_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_lessons_user_id_lesson_id_key" ON "user_lessons"("user_id", "lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_rec_id_key" ON "recommendations"("rec_id");

-- CreateIndex
CREATE INDEX "recommendations_decision_type_idx" ON "recommendations"("decision_type");

-- CreateIndex
CREATE INDEX "recommendations_decision_domain_idx" ON "recommendations"("decision_domain");

-- CreateIndex
CREATE INDEX "recommendations_tracking_status_idx" ON "recommendations"("tracking_status");

-- CreateIndex
CREATE INDEX "recommendations_tracking_status_final_outcome_idx" ON "recommendations"("tracking_status", "final_outcome");

-- CreateIndex
CREATE INDEX "recommendations_created_at_idx" ON "recommendations"("created_at");

-- CreateIndex
CREATE INDEX "recommendations_decision_domain_tracking_status_idx" ON "recommendations"("decision_domain", "tracking_status");

-- CreateIndex
CREATE INDEX "checkpoints_schedule_at_idx" ON "checkpoints"("schedule_at");

-- CreateIndex
CREATE INDEX "checkpoints_recommendation_id_evaluated_at_idx" ON "checkpoints"("recommendation_id", "evaluated_at");

-- CreateIndex
CREATE UNIQUE INDEX "checkpoints_recommendation_id_checkpoint_key" ON "checkpoints"("recommendation_id", "checkpoint");

-- CreateIndex
CREATE UNIQUE INDEX "decision_memories_memory_id_key" ON "decision_memories"("memory_id");

-- CreateIndex
CREATE INDEX "decision_memories_domain_idx" ON "decision_memories"("domain");

-- CreateIndex
CREATE INDEX "decision_memories_last_referenced_at_idx" ON "decision_memories"("last_referenced_at");

-- CreateIndex
CREATE UNIQUE INDEX "decision_memories_domain_technology_project_id_key" ON "decision_memories"("domain", "technology", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "trust_scores_level_domain_decision_type_key" ON "trust_scores"("level", "domain", "decision_type");

-- CreateIndex
CREATE INDEX "accuracy_snapshots_snapshot_date_idx" ON "accuracy_snapshots"("snapshot_date");

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_lessons" ADD CONSTRAINT "user_lessons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_lessons" ADD CONSTRAINT "user_lessons_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_options" ADD CONSTRAINT "recommendation_options_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
