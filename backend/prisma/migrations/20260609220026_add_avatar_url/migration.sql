-- CreateEnum
CREATE TYPE "DetectorType" AS ENUM ('STRUCTURE', 'POLICY', 'API_CONTRACT');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT;

-- CreateTable
CREATE TABLE "drift_events" (
    "id" TEXT NOT NULL,
    "detector_type" "DetectorType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source_path" TEXT,
    "expected_value" TEXT,
    "actual_value" TEXT,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drift_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drift_events_detector_type_idx" ON "drift_events"("detector_type");

-- CreateIndex
CREATE INDEX "drift_events_severity_idx" ON "drift_events"("severity");

-- CreateIndex
CREATE INDEX "drift_events_is_resolved_idx" ON "drift_events"("is_resolved");

-- CreateIndex
CREATE INDEX "drift_events_detected_at_idx" ON "drift_events"("detected_at");

-- CreateIndex
CREATE INDEX "drift_events_detector_type_is_resolved_idx" ON "drift_events"("detector_type", "is_resolved");
