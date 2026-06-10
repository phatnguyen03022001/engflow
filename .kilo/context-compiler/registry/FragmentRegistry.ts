/* @lifecycle ACTIVE — FragmentRegistry: static cost amortization via block deduplication across agent prompts (TASK-060) */

import * as crypto from 'crypto';
import * as fs from 'fs';
import {
  Fragment,
  FragmentRegistryResult,
  FragmentSavings,
  AgentPrompt,
} from '../ir/types';

export class FragmentRegistry {
  private fragments: Map<string, Fragment>;

  constructor() {
    this.fragments = new Map();
  }

  build(kiloJsoncPath: string): FragmentRegistryResult {
    const agents = this.parseAgentPrompts(kiloJsoncPath);
    const extracted = this.extractRepeatedBlocks(agents);
    for (const fragment of extracted) {
      this.fragments.set(fragment.id, fragment);
    }
    return {
      fragments: Array.from(this.fragments.values()),
      savings: this.computeTotalSavings(agents),
      mapping: this.buildAgentFragmentMap(agents),
    };
  }

  private parseAgentPrompts(kiloJsoncPath: string): AgentPrompt[] {
    const raw = fs.readFileSync(kiloJsoncPath, 'utf-8');
    const clean = stripJsoncComments(raw);
    const parsed = JSON.parse(clean);
    const agents: AgentPrompt[] = [];

    const agentMap = parsed.agent ?? {};
    for (const [key, value] of Object.entries(agentMap)) {
      const agent = value as Record<string, unknown>;
      if (typeof agent.prompt === 'string') {
        agents.push({ id: key, systemPrompt: agent.prompt });
      }
    }

    return agents;
  }

  private extractRepeatedBlocks(agents: AgentPrompt[]): Fragment[] {
    const hashBuckets = new Map<string, { block: string; agents: string[] }>();

    for (const agent of agents) {
      const blocks = this.extractBlocks(agent.systemPrompt);
      for (const block of blocks) {
        const h = this.hash(block);
        const existing = hashBuckets.get(h);
        if (existing) {
          if (!existing.agents.includes(agent.id)) {
            existing.agents.push(agent.id);
          }
        } else {
          hashBuckets.set(h, { block, agents: [agent.id] });
        }
      }
    }

    const fragments: Fragment[] = [];
    for (const [hash, { block, agents }] of hashBuckets) {
      if (agents.length >= 2) {
        fragments.push(this.buildFragment(hash, agents as any, block));
      }
    }

    return fragments;
  }

  private extractBlocks(prompt: string): string[] {
    return prompt
      .split('\n\n')
      .map((b) => b.trim())
      .filter((b) => b.length > 20);
  }

  private normalizeBlock(block: string): string {
    return block
      .replace(/\s+/g, ' ')
      .replace(/ADR-\w+/g, 'ADR-*')
      .replace(/TASK-\w+/g, 'TASK-*')
      .replace(/§\d+(?:\.\d+)*/g, '§*')
      .trim();
  }

  private hash(block: string): string {
    return crypto
      .createHash('sha256')
      .update(this.normalizeBlock(block))
      .digest('hex');
  }

  private buildFragment(
    hash: string,
    usage: string[],
    block: string
  ): Fragment {
    const tokens = Math.ceil(block.length / 4);
    return {
      id: `frag_${hash.slice(0, 12)}`,
      content: block,
      tokens,
      usageCount: usage.length,
      type: 'global_once',
      amortizedCost: Math.ceil(tokens / usage.length),
      sourceAgents: usage,
      hash,
    };
  }

  private computeTotalSavings(_agents: AgentPrompt[]): FragmentSavings {
    const fragments = Array.from(this.fragments.values());
    const rawCost = fragments.reduce((s, f) => s + f.tokens * f.usageCount, 0);
    const amortizedCost = fragments.reduce((s, f) => s + f.tokens, 0);
    const savings = rawCost - amortizedCost;
    const savingsPercent = rawCost > 0 ? (savings / rawCost) * 100 : 0;

    return {
      rawCost,
      amortizedCost,
      savings,
      savingsPercent,
      fragmentCount: fragments.length,
    };
  }

  private buildAgentFragmentMap(agents: AgentPrompt[]): Map<string, string[]> {
    const mapping = new Map<string, string[]>();
    for (const agent of agents) {
      mapping.set(agent.id, []);
    }
    for (const frag of this.fragments.values()) {
      for (const agentId of frag.sourceAgents) {
        const existing = mapping.get(agentId) ?? [];
        existing.push(frag.id);
        mapping.set(agentId, existing);
      }
    }
    return mapping;
  }
}

function stripJsoncComments(text: string): string {
  let result = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      result += ch;
      continue;
    }

    if (ch === '\\') {
      escape = true;
      result += ch;
      continue;
    }

    if (ch === '"' && !inString) {
      inString = true;
      result += ch;
      continue;
    }

    if (ch === '"' && inString) {
      inString = false;
      result += ch;
      continue;
    }

    if (!inString) {
      if (ch === '/' && text[i + 1] === '/') {
        while (i < text.length && text[i] !== '\n') i++;
        continue;
      }
      if (ch === '/' && text[i + 1] === '*') {
        i += 2;
        while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
        i++;
        continue;
      }
    }

    result += ch;
  }

  return result;
}
