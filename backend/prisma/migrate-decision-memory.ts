/* @lifecycle TEMPORARY — One-time migration: DecisionMemory → AgentMemory (TASK-029) */
// Run: npx tsx prisma/migrate-decision-memory.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DecisionMemory → AgentMemory migration...\n');

  // 1. Read all DecisionMemory records
  const decisionMemories = await prisma.decisionMemory.findMany();
  console.log(`Found ${decisionMemories.length} DecisionMemory records`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const dm of decisionMemories) {
    try {
      // Map outcome from DecisionMemory outcome to MemoryOutcome
      const outcomeMap: Record<string, string> = {
        SUCCESS: 'SUCCESS',
        MIXED: 'MIXED',
        FAILURE: 'FAILURE',
        ABANDONED: 'ABANDONED',
      };

      const mappedOutcome = outcomeMap[dm.outcome] ?? 'FAILURE';
      const success = dm.outcome === 'SUCCESS';

      // Derive lessons from successFactors + failureFactors
      const lessons: string[] = [];
      if (dm.successFactors && dm.successFactors.length > 0) {
        lessons.push(...dm.successFactors.map((f) => `Success factor: ${f}`));
      }
      if (dm.failureFactors && dm.failureFactors.length > 0) {
        lessons.push(...dm.failureFactors.map((f) => `Failure factor: ${f}`));
      }
      if (lessons.length === 0) {
        lessons.push(`Recommendation outcome: ${dm.outcome}`);
      }

      // Map contextFactors JSON
      const context =
        dm.contextFactors ??
        { domain: dm.domain, technology: dm.technology };

      // Handle recommendationId → sourceExecutionId
      const sourceExecutionId = dm.recommendationId ?? `MIGRATED-${dm.id}`;

      // Upsert to handle duplicates
      const existing = await prisma.agentMemory.findFirst({
        where: {
          sourceExecutionId,
          agentType: 'PLAN',
        },
      });

      if (existing) {
        await prisma.agentMemory.update({
          where: { id: existing.id },
          data: {
            outcome: mappedOutcome as any,
            success,
            context: context as any,
            lessonsLearned: lessons,
            decayWeight: dm.decayWeight,
            referenceCount: dm.referenceCount,
            domain: dm.domain,
            technology: dm.technology,
            projectId: dm.projectId,
          },
        });
        migrated++;
      } else {
        await prisma.agentMemory.create({
          data: {
            memoryId: dm.memoryId,
            agentType: 'PLAN',
            taskType: 'RECOMMENDATION_ASSESSMENT',
            context: context as any,
            decision: dm.technology,
            outcome: mappedOutcome as any,
            success,
            lessonsLearned: lessons,
            sourceExecutionId,
            domain: dm.domain,
            technology: dm.technology,
            projectId: dm.projectId,
            applicabilityScore: dm.applicabilityScore ?? undefined,
            referenceCount: dm.referenceCount,
            decayWeight: dm.decayWeight,
            lastReferencedAt: dm.lastReferencedAt ?? undefined,
            expiresAt: dm.expiresAt ?? undefined,
          },
        });
        migrated++;
      }
    } catch (error) {
      console.error(`  ❌ Failed to migrate ${dm.memoryId}: ${(error as Error).message}`);
      errors++;
    }
  }

  // 3. Summary
  const agentMemoryCount = await prisma.agentMemory.count();
  const decisionMemoryCount = await prisma.decisionMemory.count();

  console.log(`\nMigration complete.`);
  console.log(`  Total DecisionMemory records: ${decisionMemoryCount}`);
  console.log(`  Migrated to AgentMemory: ${migrated}`);
  console.log(`  Skipped (duplicates): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total AgentMemory in DB: ${agentMemoryCount}`);

  // Verification
  const migratedCount = await prisma.agentMemory.count({
    where: { sourceExecutionId: { not: null } },
  });
  console.log(`  AgentMemory with sourceExecutionId: ${migratedCount}`);

  if (migratedCount !== decisionMemoryCount) {
    console.warn(
      `  ⚠️  Mismatch: ${migratedCount} AgentMemory vs ${decisionMemoryCount} DecisionMemory`,
    );
  } else {
    console.log(`  ✅ Counts match — migration verified.`);
  }
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
