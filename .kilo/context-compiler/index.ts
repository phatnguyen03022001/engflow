/* @lifecycle ACTIVE — Context compiler entry: parse, build registry, build dual graph (TASK-060) */

import * as path from 'path';
import * as fs from 'fs';
import { SectionRegistry } from './registry/SectionRegistry';
import { buildGraph } from './graph';

const RULES_DIR = path.resolve(__dirname, '..', 'rules');
const OUTPUT_DIR = path.resolve(__dirname);

async function main() {
  console.error(`Scanning rules directory: ${RULES_DIR}`);

  const registry = await SectionRegistry.build(RULES_DIR);
  const index = registry.toIndex();

  const { dual, optResult, budgetMap, fragmentResult } = await buildGraph(registry);

  const dep = dual.dependency;
  const sim = dual.similarity;

  const output = {
    files: index.files,
    sectionCount: index.sectionCount,
    dependencyGraph: dep.stats,
    similarityGraph: sim.stats,
    generatedAt: index.generatedAt,
  };

  const json = JSON.stringify(output, null, 2);
  console.log(json);

  const outPath = path.join(OUTPUT_DIR, 'registry.json');
  fs.writeFileSync(outPath, json, 'utf-8');
  console.error(`\nRegistry written to: ${outPath}`);

  // Serialize FragmentRegistry output for guard injection
  const fragmentOutPath = path.resolve(__dirname, 'fragments.json');
  const serializable = {
    ...fragmentResult,
    mapping: Object.fromEntries(fragmentResult.mapping),
  };
  fs.writeFileSync(fragmentOutPath, JSON.stringify(serializable, null, 2));
  console.error(`Fragments written to: ${fragmentOutPath}`);
  console.error(`Total files: ${index.files.length}`);
  console.error(`Total sections: ${index.sectionCount}`);

  console.error(`\n── Dependency Graph ──`);
  console.error(`Edges: ${dep.stats.edgeCount}`);
  console.error(`Density: ${dep.stats.density.toFixed(4)}`);
  console.error(`SCCs: ${dep.stats.cycleCount}`);
  console.error(`Largest SCC: ${dep.stats.stronglyConnectedSize}`);

  console.error(`\n── Similarity Graph ──`);
  console.error(`Edges: ${sim.stats.edgeCount}`);
  console.error(`Density: ${sim.stats.density.toFixed(4)}`);

  const allCosts = registry.getAll()
    .map(s => s.cost)
    .filter(Boolean);
  const avgCumulative = allCosts.reduce((s, c) => s + c!.cumulative, 0) / allCosts.length;
  const avgRisk = allCosts.reduce((s, c) => s + c!.risk, 0) / allCosts.length;

  console.error(`\n── Cost Metrics ──`);
  console.error(`Average cumulative cost: ${avgCumulative.toFixed(1)}`);
  console.error(`Average risk: ${avgRisk.toFixed(2)}`);

  console.error(`\n── Optimizer Pipeline ──`);
  console.error(`Passes: ${optResult.diagnostics.passOrder.join(', ') || '(none registered)'}`);
  console.error(`Rollbacks: ${optResult.diagnostics.rollbackCount}/${optResult.passResults.length}`);
  console.error(`Net token reduction: ${optResult.diagnostics.netGainTokens}`);
  console.error(`Net risk reduction: ${optResult.diagnostics.netRiskReduction.toFixed(2)}`);

  console.error(`\n── Budget Controller ──`);
  for (const [agent, info] of Object.entries(budgetMap)) {
    const emoji = info.status === 'ok' ? '✓' : '✗';
    console.error(`  ${emoji} ${agent}: ${info.totalCost.toFixed(0)}/${info.budget} tokens (${info.status})`);
  }

  console.error(`\n── Fragment Registry ──`);
  console.error(`Fragment count: ${fragmentResult.savings.fragmentCount}`);
  console.error(`Raw cost: ${fragmentResult.savings.rawCost} tokens`);
  console.error(`Amortized cost: ${fragmentResult.savings.amortizedCost} tokens`);
  console.error(`Savings: ${fragmentResult.savings.savingsPercent.toFixed(1)}%`);
  for (const frag of fragmentResult.fragments) {
    console.error(`  ${frag.id}: tokens=${frag.tokens}, x${frag.usageCount}=${frag.tokens * frag.usageCount} raw, amortized=${frag.amortizedCost}/agent, agents=[${frag.sourceAgents.join(', ')}]`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
