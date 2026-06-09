// @lifecycle TEMPORARY — One-time seed script for trust score + decision memory data
// Run: npx ts-node prisma/seed-recommendations.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DECISION_DOMAINS = ['backend', 'frontend', 'infrastructure', 'database', 'auth'];
const DECISION_TYPES = ['TC', 'AP', 'IA', 'TS', 'PC', 'BB'];
const MODES = ['ADVISOR', 'STRATEGY', 'LEADERSHIP'];
const CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW'];
const OUTCOMES = ['SUCCESS', 'FAILURE', 'MIXED', 'ABANDONED'] as const;
const STATUSES = ['PENDING', 'IN_PROGRESS', 'ASSESSED'] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRecId(index: number): string {
  return `SEED-REC-${String(index).padStart(3, '0')}`;
}

async function main() {
  console.log('🌱 Seeding recommendations...\n');

  // ─── 10 recommendations with varied trackingStatus + finalOutcome ───
  const seedData = [
    // Success stories (ASSESSED + SUCCESS)
    { index: 1, status: 'ASSESSED' as const, outcome: 'SUCCESS' as const, domain: 'backend', dt: 'TC', mode: 'ADVISOR', conf: 'HIGH', confScore: 85 },
    { index: 2, status: 'ASSESSED' as const, outcome: 'SUCCESS' as const, domain: 'auth', dt: 'IA', mode: 'STRATEGY', conf: 'HIGH', confScore: 90 },
    { index: 3, status: 'ASSESSED' as const, outcome: 'SUCCESS' as const, domain: 'database', dt: 'TS', mode: 'LEADERSHIP', conf: 'MEDIUM', confScore: 72 },
    // Mixed outcome (ASSESSED + MIXED)
    { index: 4, status: 'ASSESSED' as const, outcome: 'MIXED' as const, domain: 'frontend', dt: 'AP', mode: 'ADVISOR', conf: 'MEDIUM', confScore: 65 },
    // Failure (ASSESSED + FAILURE)
    { index: 5, status: 'ASSESSED' as const, outcome: 'FAILURE' as const, domain: 'infrastructure', dt: 'BB', mode: 'STRATEGY', conf: 'LOW', confScore: 40 },
    // Abandoned (ASSESSED + ABANDONED — should be skipped by decision memory)
    { index: 6, status: 'ASSESSED' as const, outcome: 'ABANDONED' as const, domain: 'backend', dt: 'PC', mode: 'LEADERSHIP', conf: 'LOW', confScore: 30 },
    // In-progress (not yet assessed)
    { index: 7, status: 'IN_PROGRESS' as const, outcome: null, domain: 'database', dt: 'TC', mode: 'ADVISOR', conf: 'HIGH', confScore: 80 },
    { index: 8, status: 'IN_PROGRESS' as const, outcome: null, domain: 'frontend', dt: 'IA', mode: 'STRATEGY', conf: 'MEDIUM', confScore: 60 },
    // Pending (not yet started)
    { index: 9, status: 'PENDING' as const, outcome: null, domain: 'auth', dt: 'AP', mode: 'ADVISOR', conf: 'HIGH', confScore: 75 },
    { index: 10, status: 'PENDING' as const, outcome: null, domain: 'infrastructure', dt: 'TS', mode: 'LEADERSHIP', conf: 'MEDIUM', confScore: 55 },
  ];

  for (const rec of seedData) {
    const recId = generateRecId(rec.index);

    // Check if already exists
    const existing = await prisma.recommendation.findUnique({ where: { recId } });
    if (existing) {
      console.log(`  ⏭️  ${recId} already exists, skipping`);
      continue;
    }

    const options = [
      { label: `${rec.domain}-option-a`, description: `Primary approach for ${rec.domain}`, score: rec.confScore / 20 },
      { label: `${rec.domain}-option-b`, description: `Alternative approach for ${rec.domain}`, score: rec.confScore / 20 - 0.5 },
    ];

    await prisma.recommendation.create({
      data: {
        recId,
        mode: rec.mode,
        decisionType: rec.dt,
        decisionDomain: rec.domain,
        querySummary: `Seed recommendation: ${rec.dt} decision for ${rec.domain} domain`,
        projectId: '__global__',
        constraints: ['budget', 'timeline'],
        sourcesConsulted: ['architecture.md', 'docs/decisions.md'],
        architectureVersion: '1.0.0',
        constitutionVersion: '1.0.0',
        recommendedOption: options[0].label,
        weightedScore: options[0].score,
        scoreMargin: 0.3,
        justification: `Recommended ${options[0].label} over ${options[1].label} for ${rec.domain} ${rec.dt} decision.`,
        confidenceLevel: rec.conf,
        confidenceScore: rec.confScore,
        ecs: 70,
        sqs: 65,
        cs: 75,
        unknownsCount: 2,
        unknownsCritical: 0,
        expectedOutcome: 'Improved system reliability',
        debtForecast: 'Low',
        timelineToValue: '2-4 weeks',
        prerequisites: ['Code review', 'Team sync'],
        whenToRevisit: '3 months',
        options: { create: options },
        successCriteria: ['Passes all tests', 'Meets performance targets'],
        predictedRisks: { risk1: 'Migration complexity', risk2: 'Team learning curve' } as any,
        riskMitigations: ['Pair programming', 'Documentation'],
        reasoningTrace: 'trace-' + recId,
        modelVersion: 'deepseek-v4-flash',
        trackingStatus: rec.status,
        finalOutcome: rec.outcome,
        assessedAt: rec.outcome ? new Date() : null,
      },
    });

    console.log(`  ✅ ${recId} created  [status=${rec.status.padEnd(12)} outcome=${rec.outcome?.padEnd(10) ?? 'N/A'.padEnd(10)} domain=${rec.domain.padEnd(15)} dt=${rec.dt}]`);
  }

  // ─── Create checkpoints for ASSESSED recommendations ───
  // Creates all three checkpoints (30D, 90D, 180D) with scheduleAt set relative
  // to assessedAt for realistic historical timestamps.
  console.log('\n📋 Creating checkpoints for ASSESSED recommendations...');

  const assessedRecs = await prisma.recommendation.findMany({
    where: { trackingStatus: 'ASSESSED', finalOutcome: { not: null } },
  });

  const checkpointPeriods = ['30D', '90D', '180D'] as const;
  const periodDays: Record<string, number> = { '30D': 30, '90D': 90, '180D': 180 };

  for (const rec of assessedRecs) {
    const assessedAt = rec.assessedAt ?? new Date();

    for (const period of checkpointPeriods) {
      const daysOffset = periodDays[period];
      const scheduleAt = new Date(assessedAt.getTime() - daysOffset * 24 * 60 * 60 * 1000);

      await prisma.checkpoint.upsert({
        where: {
          recommendationId_checkpoint: {
            recommendationId: rec.id,
            checkpoint: period,
          },
        },
        update: {},
        create: {
          recommendationId: rec.id,
          checkpoint: period,
          evaluator: 'seed-script',
          evidenceSources: ['Code review', 'Test results'],
          wasImplemented: rec.finalOutcome !== 'ABANDONED',
          implementedOption: rec.recommendedOption,
          implementationFaith: rec.finalOutcome === 'SUCCESS' ? 'EXACT' : 'ADAPTED',
          problemSolved: rec.finalOutcome !== 'FAILURE',
          solutionScore: rec.finalOutcome === 'SUCCESS' ? 5 : rec.finalOutcome === 'MIXED' ? 3 : 1,
          performanceImpact: rec.finalOutcome === 'SUCCESS' ? 'IMPROVED' : 'NEUTRAL',
          teamSatisfaction: rec.finalOutcome === 'SUCCESS' ? 'SATISFIED' : 'NEUTRAL',
          riskAssessmentAcc: rec.finalOutcome === 'SUCCESS' ? 4 : 2,
          forecastAccurate: rec.finalOutcome !== 'FAILURE',
          timelineAccurate: rec.finalOutcome !== 'FAILURE',
          checkpointVerdict: rec.finalOutcome === 'SUCCESS' ? 'ON_TRACK' : rec.finalOutcome === 'MIXED' ? 'CONCERN' : 'FAILED',
          verdictConfidence: 'HIGH',
          notes: `Seed checkpoint ${period} for ${rec.recId}`,
          scheduleAt,
          completedAt: new Date(),
          evaluatedAt: new Date(),
        },
      });

      console.log(`  📌 Checkpoint ${period} created for ${rec.recId}`);
    }
  }

  // ─── Create checkpoints for IN_PROGRESS recommendations ───
  // These simulate recently started implementations with only the 30D checkpoint
  // evaluated (ON_TRACK), while 90D and 180D are still pending.
  console.log('\n📋 Creating checkpoints for IN_PROGRESS recommendations...');

  const inProgressRecs = await prisma.recommendation.findMany({
    where: { trackingStatus: 'IN_PROGRESS' },
  });

  for (const rec of inProgressRecs) {
    for (const period of checkpointPeriods) {
      const daysOffset = periodDays[period];
      const scheduleAt = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000);
      const is30d = period === '30D';

      await prisma.checkpoint.upsert({
        where: {
          recommendationId_checkpoint: {
            recommendationId: rec.id,
            checkpoint: period,
          },
        },
        update: {},
        create: {
          recommendationId: rec.id,
          checkpoint: period,
          evaluator: 'seed-script',
          evidenceSources: is30d ? ['Code review', 'Test results'] : [],
          wasImplemented: is30d ? true : undefined,
          implementedOption: is30d ? rec.recommendedOption : undefined,
          implementationFaith: is30d ? 'EXACT' : undefined,
          problemSolved: is30d ? true : undefined,
          solutionScore: is30d ? 4 : undefined,
          performanceImpact: is30d ? 'IMPROVED' : undefined,
          teamSatisfaction: is30d ? 'SATISFIED' : undefined,
          riskAssessmentAcc: is30d ? 4 : undefined,
          forecastAccurate: is30d ? true : undefined,
          timelineAccurate: is30d ? true : undefined,
          checkpointVerdict: is30d ? 'ON_TRACK' : undefined,
          verdictConfidence: is30d ? 'HIGH' : undefined,
          notes: `Seed checkpoint ${period} for ${rec.recId}`,
          scheduleAt,
          evaluatedAt: is30d ? new Date() : null,
          completedAt: is30d ? new Date() : null,
        },
      });

      console.log(`  📌 Checkpoint ${period} created for ${rec.recId}${is30d ? ' (evaluated)' : ' (pending)'}`);
    }
  }

  // ─── Manually populate decision_memories from assessed recommendations ───
  // The createFromAssessment flow checks ASSESSED status + finalOutcome.
  // We do it here directly for completeness.
  console.log('\n🧠 Creating decision memories...');

  for (const rec of assessedRecs) {
    if (rec.finalOutcome === 'ABANDONED') {
      console.log(`  ⏭️  ${rec.recId} was ABANDONED — skipping decision memory`);
      continue;
    }

    await prisma.decisionMemory.upsert({
      where: {
        domain_technology_projectId: {
          domain: rec.decisionDomain,
          technology: rec.recommendedOption,
          projectId: rec.projectId ?? '__global__',
        },
      },
      update: {
        outcome: rec.finalOutcome!,
        contextFactors: {
          domain: rec.decisionDomain,
          decisionType: rec.decisionType,
          confidenceLevel: rec.confidenceLevel,
          confidenceScore: rec.confidenceScore,
          recommendedOption: rec.recommendedOption,
        } as any,
      },
      create: {
        memoryId: `MEM-SEED-${rec.recId}`,
        domain: rec.decisionDomain,
        technology: rec.recommendedOption,
        projectId: rec.projectId ?? '__global__',
        recommendationId: rec.id,
        outcome: rec.finalOutcome!,
        contextFactors: {
          domain: rec.decisionDomain,
          decisionType: rec.decisionType,
          confidenceLevel: rec.confidenceLevel,
          confidenceScore: rec.confidenceScore,
          recommendedOption: rec.recommendedOption,
        } as any,
        referenceCount: 1,
        lastReferencedAt: new Date(),
      },
    });

    console.log(`  🧠 Memory created for ${rec.recId} (outcome=${rec.finalOutcome})`);
  }

  // ─── Recalculate trust scores ───
  // Delete existing and re-insert (safe: seed owns this data)
  console.log('\n📊 Recalculating trust scores...');

  await prisma.$executeRawUnsafe(`DELETE FROM trust_scores`);

  // Compute GLOBAL
  const globalAssessed = await prisma.recommendation.findMany({
    where: { trackingStatus: 'ASSESSED', finalOutcome: { not: null } },
    select: { finalOutcome: true },
  });

  const globalScore = computeScore(globalAssessed, 6, 4);
  await prisma.$executeRawUnsafe(`
    INSERT INTO trust_scores (id, level, domain, decision_type, score, sample_size, prior_alpha, prior_beta, created_at, updated_at)
    VALUES (gen_random_uuid(), 'GLOBAL', NULL, NULL, $1, $2, 6, 4, NOW(), NOW())
  `, globalScore, globalAssessed.length);
  console.log(`  🌐 GLOBAL trust score: ${globalScore} (n=${globalAssessed.length})`);

  // Compute by DECISION_TYPE
  const dtPrior: Record<string, { alpha: number; beta: number }> = {
    TC: { alpha: 8, beta: 2 }, TS: { alpha: 8, beta: 2 }, IA: { alpha: 7, beta: 3 },
    BB: { alpha: 6, beta: 4 }, PC: { alpha: 5, beta: 5 }, AP: { alpha: 5, beta: 5 },
  };

  for (const [dt, prior] of Object.entries(dtPrior)) {
    const assessed = await prisma.recommendation.findMany({
      where: { decisionType: dt, trackingStatus: 'ASSESSED', finalOutcome: { not: null } },
      select: { finalOutcome: true },
    });
    if (assessed.length === 0) continue;
    const score = computeScore(assessed, prior.alpha, prior.beta);
    await prisma.$executeRawUnsafe(`
      INSERT INTO trust_scores (id, level, domain, decision_type, score, sample_size, prior_alpha, prior_beta, created_at, updated_at)
      VALUES (gen_random_uuid(), 'DECISION_TYPE', NULL, $1, $2, $3, $4, $5, NOW(), NOW())
    `, dt, score, assessed.length, prior.alpha, prior.beta);
    console.log(`  📊 ${dt} trust score: ${score} (n=${assessed.length})`);
  }

  // Compute by DOMAIN
  const allAssessed = await prisma.recommendation.findMany({
    where: { trackingStatus: 'ASSESSED', finalOutcome: { not: null } },
    select: { decisionDomain: true, finalOutcome: true },
  });

  const grouped = new Map<string, Array<{ finalOutcome: string | null }>>();
  for (const r of allAssessed) {
    const list = grouped.get(r.decisionDomain) ?? [];
    list.push({ finalOutcome: r.finalOutcome });
    grouped.set(r.decisionDomain, list);
  }

  for (const [domain, assessed] of grouped) {
    const score = computeScore(assessed, 6, 4);
    await prisma.$executeRawUnsafe(`
      INSERT INTO trust_scores (id, level, domain, decision_type, score, sample_size, prior_alpha, prior_beta, created_at, updated_at)
      VALUES (gen_random_uuid(), 'DOMAIN', $1, NULL, $2, $3, 6, 4, NOW(), NOW())
    `, domain, score, assessed.length);
    console.log(`  🏷️  ${domain} trust score: ${score} (n=${assessed.length})`);
  }

  console.log('\n✅ Seed complete!');
  console.log('\nRun the following commands to verify:');
  console.log('  curl -X POST http://localhost:3001/api/v1/recommendations/trust-scores/recalculate -H "Authorization: Bearer <TOKEN>"');
  console.log('  curl http://localhost:3001/api/v1/recommendations/stats -H "Authorization: Bearer <TOKEN>"');
  console.log('  curl http://localhost:3001/api/v1/recommendations/executive-review -H "Authorization: Bearer <TOKEN>"');
}

function computeScore(
  assessed: Array<{ finalOutcome: string | null }>,
  alpha: number,
  beta: number,
): number {
  if (assessed.length === 0) return 60; // priorTrust * 100 = 0.6 * 100

  let weightedSuccesses = 0;
  for (const r of assessed) {
    if (r.finalOutcome === 'SUCCESS') weightedSuccesses += 1;
    else if (r.finalOutcome === 'MIXED') weightedSuccesses += 0.5;
    // FAILURE and ABANDONED count as 0
  }

  return Math.round(((weightedSuccesses + alpha) / (assessed.length + alpha + beta)) * 100);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
