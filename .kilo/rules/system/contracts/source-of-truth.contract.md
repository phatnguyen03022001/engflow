/* @lifecycle ACTIVE — Source of Truth Hierarchy: Priority order and authority rules */
/* @tags all */

# Source of Truth Hierarchy

## Priority Order

| Priority | Source | Authority |
|----------|--------|-----------|
| 1 | CI / Automated Validation | Machine-enforced |
| 2 | ADRs (docs/decisions.md) | Architecture decisions |
| 3 | Constitution (docs/constitution.md) | Immutable rules |
| 4 | Architecture (docs/architecture.md) | System design |
| 5 | Canonical System Contracts (.kilo/rules/system/contracts/) | Runtime enforcement |
| 6 | Agent Rules (.kilo/rules/agents/) | Agent behavior |
| 7 | Task Requirements | Current execution |
| 8 | Codebase | Implementation |

## Rules

- Higher priority overrides lower priority
- Codebase is never authoritative over contracts
- Model memory is never authoritative
