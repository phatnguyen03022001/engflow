#!/bin/bash
# @lifecycle ACTIVE — Constitution Compliance Checker
#
# Validates code against Constitution rules:
#   §4 — No console.log in production code
#   §4 — No `any` types (with exceptions)
#   §4 — DTOs must use class-validator decorators
#   §8 — Lifecycle declarations on all new files (delegates to lifecycle-validator.sh)
#
# Usage:
#   bash .kilo/validate/check-constitution.sh
#   bash .kilo/validate/check-constitution.sh --verbose
#
# Exit codes:
#   0 — all checks pass
#   1 — one or more checks fail
#
# Default source directory (overridable via SRC_DIR env var)
# shellcheck disable=SC2086

set -o nounset
set -o errexit
set -o pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

readonly SRC_DIR="${SRC_DIR:-backend/src}"
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
VERBOSE=false

# ─── Helpers ──────────────────────────────────────────────────────────────────

info()  { echo -e "  ${GREEN}INFO${NC}  $1"; }
pass()  { echo -e "  ${GREEN}PASS${NC}  $1"; ((PASS_COUNT++)); }
fail()  { echo -e "  ${RED}FAIL${NC}  $1"; ((FAIL_COUNT++)); }
warn()  { echo -e "  ${YELLOW}WARN${NC}  $1"; ((WARN_COUNT++)); }
verbose() { if [[ "$VERBOSE" == "true" ]]; then echo "        $1"; fi; }

# ─── Check 1: No console.log in production code ───────────────────────────────
# Constitution §4: "No console.log in production code"

check_no_console_log() {
  echo ""
  echo "─── Check §4: No console.log in production code ───"

  local found=0
  while IFS=: read -r file line; do
    if [[ -n "$file" ]]; then
      fail "console.log found in $file:$line"
      verbose "Remove console.log or replace with NestJS Logger"
      found=1
    fi
  done < <(
    grep -rn 'console\.log(' "$SRC_DIR" \
      --include='*.ts' \
      --exclude='*.spec.ts' \
      --exclude='*.e2e-spec.ts' \
      2>/dev/null || true
  )

  if [[ "$found" -eq 0 ]]; then
    pass "No console.log found in production code"
  fi
}

# ─── Check 2: No `any` type annotations ──────────────────────────────────────
# Constitution §4: "TypeScript strict mode required (no `any` types)"
# Exclusions:
#   - jest.fn<any>()  — Jest mock factory generic
#   - as any          — intentional escape hatch
#   - eslint-disable  — explicitly suppressed

check_no_any_type() {
  echo ""
  echo "─── Check §4: No \`any\` type annotations ───"

  local found=0
  while IFS=: read -r file line; do
    if [[ -n "$file" ]]; then
      # Show context of the match
      local context
      context="$(sed -n "${line}p" "$file" 2>/dev/null | sed 's/^[[:space:]]*//' | head -c 120)"
      fail "'any' type in $file:$line"
      verbose "$context"
      found=1
    fi
  done < <(
    grep -rn '\bany\b' "$SRC_DIR" \
      --include='*.ts' \
      --exclude='*.spec.ts' \
      --exclude='*.e2e-spec.ts' \
      2>/dev/null \
      | grep -v 'jest\.fn<any>' \
      | grep -v 'as any' \
      | grep -v 'eslint-disable' \
      | grep -v 'node_modules' \
      || true
  )

  if [[ "$found" -eq 0 ]]; then
    pass "No \`any\` types found in production code"
  fi
}

# ─── Check 3: DTOs use class-validator decorators ────────────────────────────
# Constitution §4: "All DTOs must use class-validator decorators"

check_dto_validators() {
  echo ""
  echo "─── Check §4: DTOs use class-validator decorators ───"

  local dto_files
  dto_files="$(find "$SRC_DIR" -path '*/dto/*.ts' -not -path '*/node_modules/*' 2>/dev/null || true)"

  if [[ -z "$dto_files" ]]; then
    warn "No DTO files found in $SRC_DIR"
    return
  fi

  local checked=0
  local missing=0

  while IFS= read -r dto_file; do
    # Skip spec files
    if echo "$dto_file" | grep -qE '\.spec\.ts$|\.e2e-spec\.ts$'; then
      continue
    fi

    ((checked++))

    # Check that the file imports from class-validator
    if ! grep -q "from 'class-validator'" "$dto_file" 2>/dev/null; then
      missing=1
      local rel_path="${dto_file#$SRC_DIR/}"
      fail "Missing class-validator imports in dto/$rel_path"
      verbose "Add: import { IsString, IsOptional, ... } from 'class-validator'"
    fi
  done <<< "$dto_files"

  if [[ "$checked" -eq 0 ]]; then
    warn "No DTO files checked (all skipped or none found)"
  elif [[ "$missing" -eq 0 ]]; then
    pass "All $checked DTO files use class-validator decorators"
  fi
}

# ─── Check 4: Lifecycle declarations on changed files ────────────────────────
# Constitution §8 / ADR-008: "Lifecycle declarations on all new files"
# Delegates to lifecycle-validator.sh

check_lifecycle_declarations() {
  echo ""
  echo "─── Check §8: Lifecycle declarations (ADR-008) ───"

  if [[ -f ".kilo/validate/lifecycle-validator.sh" ]]; then
    # Check staged + untracked files (local development) or specific paths (CI)
    bash .kilo/validate/lifecycle-validator.sh && pass "Lifecycle declarations valid" || fail "Lifecycle declaration issues found"
  else
    warn "lifecycle-validator.sh not found — skipping lifecycle check"
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
  # Parse --verbose
  for arg in "$@"; do
    if [[ "$arg" == "--verbose" ]]; then
      VERBOSE=true
    fi
  done

  echo "══════════════════════════════════════════════════"
  echo "  Constitution Compliance Checker"
  echo "  Source: $SRC_DIR"
  echo "══════════════════════════════════════════════════"

  check_no_console_log
  check_no_any_type
  check_dto_validators
  check_lifecycle_declarations

  echo ""
  echo "─── Summary ───"
  echo "  Pass:  $PASS_COUNT"
  echo "  Fail:  $FAIL_COUNT"
  echo "  Warn:  $WARN_COUNT"
  echo ""

  if [[ "$FAIL_COUNT" -gt 0 ]]; then
    echo "  ❌ Constitution violations detected."
    echo ""
    return 1
  fi

  echo "  ✅ Constitution compliance checks passed."
  echo ""
  return 0
}

main "$@"
