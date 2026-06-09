-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('ROUTER', 'PLAN', 'ARCHITECT', 'CODE', 'PRE_VERIFY', 'POST_VERIFY');

-- CreateEnum
CREATE TYPE "MemoryOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'MIXED', 'BLOCKED', 'ABANDONED');

-- CreateTable
CREATE TABLE "agent_memories" (
    "id" TEXT NOT NULL,
    "memory_id" TEXT NOT NULL,
    "agent_type" "AgentType" NOT NULL,
    "task_type" TEXT NOT NULL,
    "context" JSONB,
    "decision" TEXT,
    "outcome" "MemoryOutcome" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "confidence" DOUBLE PRECISION,
    "lessons_learned" TEXT[],
    "source_execution_id" TEXT,
    "source_phase_id" TEXT,
    "domain" TEXT,
    "technology" TEXT,
    "project_id" TEXT NOT NULL DEFAULT '__global__',
    "applicability_score" DOUBLE PRECISION,
    "reference_count" INTEGER NOT NULL DEFAULT 0,
    "decay_weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_referenced_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_memories_memory_id_key" ON "agent_memories"("memory_id");

-- CreateIndex
CREATE INDEX "agent_memories_agent_type_idx" ON "agent_memories"("agent_type");

-- CreateIndex
CREATE INDEX "agent_memories_task_type_idx" ON "agent_memories"("task_type");

-- CreateIndex
CREATE INDEX "agent_memories_success_idx" ON "agent_memories"("success");

-- CreateIndex
CREATE INDEX "agent_memories_domain_idx" ON "agent_memories"("domain");

-- CreateIndex
CREATE INDEX "agent_memories_agent_type_success_idx" ON "agent_memories"("agent_type", "success");

-- CreateIndex
CREATE INDEX "agent_memories_last_referenced_at_idx" ON "agent_memories"("last_referenced_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_memories_source_execution_id_agent_type_key" ON "agent_memories"("source_execution_id", "agent_type");
