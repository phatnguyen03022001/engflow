/* @lifecycle ACTIVE — BudgetController: hard enforcement gate for per-agent token budgets (TASK-060) */

import {
  PlannedSection,
  BudgetCheckResult,
  BudgetFailoverMode,
  AGENT_BUDGETS,
} from '../ir/types';
import { SectionRegistry } from '../registry/SectionRegistry';

export class BudgetController {
  private budgets: Record<string, number>;

  constructor(customBudgets?: Record<string, number>) {
    this.budgets = customBudgets ?? { ...AGENT_BUDGETS };
  }

  check(
    agentType: string,
    plannedSections: PlannedSection[],
    fragmentCost: number,
    registry: SectionRegistry
  ): BudgetCheckResult {
    const budget = this.getBudget(agentType);
    const failover = this.getFailoverMode(agentType);

    let dynamicCost = 0;
    for (const ps of plannedSections) {
      const section = registry.resolve(ps.sectionId);
      if (section?.cost?.cumulative) {
        dynamicCost += section.cost.cumulative;
      } else {
        dynamicCost += section?.tokensEst ?? 0;
      }
    }

    const staticCost = fragmentCost;
    const overheadCost = plannedSections.length * 8;
    const totalCost = staticCost + dynamicCost + overheadCost;
    const excess = Math.max(0, totalCost - budget);

    if (totalCost <= budget) {
      return {
        status: 'ok',
        totalCost,
        budget,
        excess: 0,
        failover,
        details: { staticCost, dynamicCost, overheadCost },
        actions: [],
      };
    }

    const actions = this.applyFailover(totalCost, budget, excess, failover);

    return {
      status: 'overflow',
      totalCost,
      budget,
      excess,
      failover,
      details: { staticCost, dynamicCost, overheadCost },
      actions,
    };
  }

  private applyFailover(
    totalCost: number,
    budget: number,
    excess: number,
    failover: BudgetFailoverMode
  ): string[] {
    const actions: string[] = [];

    switch (failover) {
      case 'soft':
        actions.push(`OVERFLOW: ${excess.toFixed(0)} tokens over budget of ${budget}`);
        actions.push('RECOMMEND: remove low-density sections');
        actions.push('RECOMMEND: reduce planner tokenBudget parameter');
        break;

      case 'medium':
        actions.push(`OVERFLOW: ${excess.toFixed(0)} tokens over budget of ${budget}`);
        actions.push('ACTION: dropping sections with density < 0.5');
        actions.push('ACTION: collapsing non-critical dependency chains');
        break;

      case 'hard':
        actions.push(`OVERFLOW: ${excess.toFixed(0)} tokens over budget of ${budget}`);
        actions.push('FAIL: budget exceeded, re-run planner with stricter threshold');
        actions.push('ACTION: re-plan with tokenBudget = budget - staticCost - overheadCost');
        break;
    }

    return actions;
  }

  private getBudget(agentType: string): number {
    return this.budgets[agentType] ?? AGENT_BUDGETS.ask;
  }

  private getFailoverMode(agentType: string): BudgetFailoverMode {
    const hardAgents = ['router', 'pre_verify', 'post_verify'];
    const softAgents = ['ask', 'plan'];

    if (hardAgents.includes(agentType)) return 'hard';
    if (softAgents.includes(agentType)) return 'soft';
    return 'medium';
  }
}
