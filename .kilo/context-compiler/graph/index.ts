/* @lifecycle ACTIVE — Graph pipeline orchestrator: builds DualGraph and runs cost propagation + optimizer + FragmentRegistry + budget controller (TASK-060) */

import * as path from 'path';
import { SectionRegistry } from '../registry/SectionRegistry';
import { SectionGraphBuilder } from './SectionGraphBuilder';
import { CostPropagationPass } from '../optimizer/passes/CostPropagationPass';
import { DedupPass } from '../optimizer/passes/DedupPass';
import { DefaultOptimizerPipeline } from '../optimizer/OptimizerPipeline';
import { BudgetController } from '../budget/BudgetController';
import { FragmentRegistry } from '../registry/FragmentRegistry';
import { DualGraph, OptimizationRunResult, PlannedSection, FragmentRegistryResult, Fragment } from '../ir/types';

export interface BuildResult {
  dual: DualGraph;
  optResult: OptimizationRunResult;
  budgetMap: Record<string, { budget: number; totalCost: number; status: string }>;
  fragmentResult: FragmentRegistryResult;
}

export async function buildGraph(registry: SectionRegistry): Promise<BuildResult> {
  const dual = await SectionGraphBuilder.build(registry);

  const costPass = new CostPropagationPass(registry);
  const costResult = costPass.run(dual.dependency);
  dual.dependency = costResult.graph;

  const pipeline = new DefaultOptimizerPipeline();
  pipeline.register(new DedupPass(registry));
  const optResult = pipeline.run(dual.dependency);
  dual.dependency = optResult.graph;

  registry.attachDualGraph(dual);

  const fragmentRegistry = new FragmentRegistry();
  const kiloJsoncPath = path.resolve(__dirname, '..', '..', 'kilo.jsonc');
  const fragmentResult = fragmentRegistry.build(kiloJsoncPath);

  console.error(`\n── Fragment Registry ──`);
  console.error(`Fragments found: ${fragmentResult.fragments.length}`);
  console.error(`Raw cost: ${fragmentResult.savings.rawCost}`);
  console.error(`Amortized cost: ${fragmentResult.savings.amortizedCost}`);
  console.error(`Savings: ${fragmentResult.savings.savingsPercent.toFixed(1)}%`);
  for (const frag of fragmentResult.fragments) {
    console.error(`  frag: ${frag.id} (tokens:${frag.tokens}, usage:${frag.usageCount}, amortized:${frag.amortizedCost})`);
  }

  const budgetController = new BudgetController();
  const budgetMap: Record<string, { budget: number; totalCost: number; status: string }> = {};

  const allSections = registry.getAll();
  const allPlannedSections: PlannedSection[] = allSections.map((s) => ({
    sectionId: s.id,
    relevanceScore: s.relevanceScore,
    cumulativeCost: s.cost?.cumulative,
  }));

  const agentTypes = ['router', 'ask', 'code', 'debug', 'architect-deep'];
  for (const agentType of agentTypes) {
    const agentFragIds = fragmentResult.mapping.get(agentType) ?? [];
    const fragmentCost = agentFragIds.reduce((sum, fragId) => {
      const frag = fragmentResult.fragments.find((f: Fragment) => f.id === fragId);
      return sum + (frag ? frag.amortizedCost : 0);
    }, 0);

    const result = budgetController.check(agentType, allPlannedSections, fragmentCost, registry);
    budgetMap[agentType] = {
      budget: result.budget,
      totalCost: result.totalCost,
      status: result.status,
    };
  }

  return { dual, optResult, budgetMap, fragmentResult };
}
