/* @lifecycle ACTIVE — Stub types for FragmentRegistry (TASK-FIX-TS) */

/**
 * Result from the FragmentRegistry, used by GuardService to load
 * pre-computed shared fragments for agent context hydration.
 */
export interface FragmentRegistryResult {
  fragments: { content: string }[];
}
