-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('REQUIREMENT', 'ARCHITECTURE', 'CODE', 'TEST', 'DECISION');

-- CreateEnum
CREATE TYPE "EdgeType" AS ENUM ('DEPENDS_ON', 'IMPLEMENTS', 'TESTS', 'DECIDES', 'REFERENCES', 'SUPERSEDES');

-- CreateTable
CREATE TABLE "knowledge_nodes" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "type" "NodeType" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "properties" JSONB,
    "source_file" TEXT,
    "module" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_edges" (
    "id" TEXT NOT NULL,
    "edge_id" TEXT NOT NULL,
    "source_node_id" TEXT NOT NULL,
    "target_node_id" TEXT NOT NULL,
    "type" "EdgeType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "properties" JSONB,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_nodes_node_id_key" ON "knowledge_nodes"("node_id");

-- CreateIndex
CREATE INDEX "knowledge_nodes_type_idx" ON "knowledge_nodes"("type");

-- CreateIndex
CREATE INDEX "knowledge_nodes_module_idx" ON "knowledge_nodes"("module");

-- CreateIndex
CREATE INDEX "knowledge_nodes_type_module_idx" ON "knowledge_nodes"("type", "module");

-- CreateIndex
CREATE INDEX "knowledge_nodes_is_active_idx" ON "knowledge_nodes"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_edges_edge_id_key" ON "knowledge_edges"("edge_id");

-- CreateIndex
CREATE INDEX "knowledge_edges_source_node_id_idx" ON "knowledge_edges"("source_node_id");

-- CreateIndex
CREATE INDEX "knowledge_edges_target_node_id_idx" ON "knowledge_edges"("target_node_id");

-- CreateIndex
CREATE INDEX "knowledge_edges_type_idx" ON "knowledge_edges"("type");

-- CreateIndex
CREATE INDEX "knowledge_edges_source_node_id_type_idx" ON "knowledge_edges"("source_node_id", "type");

-- AddForeignKey
ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "knowledge_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "knowledge_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
