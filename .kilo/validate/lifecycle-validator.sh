#!/bin/bash
# @lifecycle ACTIVE — Lifecycle Declaration Validator
#
# Validates that files have proper @lifecycle declarations per ADR-008.
# Can auto-insert ACTIVE declarations for new files with --fix.
#
# Usage:
#   bash .kilo/validate/lifecycle-validator.sh              # Check all staged files
#   bash .kilo/validate/lifecycle-validator.sh <path>...     # Check specific files
#   bash .kilo/validate/lifecycle-validator.sh --fix         # Auto-insert missing declarations
#   bash .kilo/validate/lifecycle-validator.sh --fix <path>  # Fix specific files
#
# Exit codes:
#   0 — all files pass or are skipped
#   1 — one or more files fail validation

set -o nounset
set -o errexit

# ─── Configuration ────────────────────────────────────────────────────────────

readonly VALID_STATES=("ACTIVE" "GENERATED" "TEMPORARY" "EXPERIMENTAL" "ARCHIVED")
readonly DEFAULT_STATE="ACTIVE"
readonly DEFAULT_REASON="default"

# File extensions to skip (binary or auto-generated)
readonly SKIP_EXTENSIONS=(
  ".png" ".jpg" ".jpeg" ".gif" ".ico" ".svg"
  ".woff" ".woff2" ".eot" ".ttf" ".otf"
  ".zip" ".tar" ".gz" ".bz2"
  ".pdf" ".doc" ".docx"
  ".DS_Store"
)

# Files to always skip (exact basenames)
readonly SKIP_FILES=(
  ".DS_Store"
  ".env"
  ".env.local"
  ".env.example"
  "package-lock.json"
  "yarn.lock"
  "pnpm-lock.yaml"
)

# ─── Helpers ──────────────────────────────────────────────────────────────────

is_skip_extension() {
  local file="$1"
  for ext in "${SKIP_EXTENSIONS[@]}"; do
    if [[ "$file" == *"$ext" ]]; then
      return 0
    fi
  done
  return 1
}

is_skip_file() {
  local basename
  basename="$(basename "$1")"
  for skip in "${SKIP_FILES[@]}"; do
    if [[ "$basename" == "$skip" ]]; then
      return 0
    fi
  done
  return 1
}

is_valid_state() {
  local state="$1"
  for valid in "${VALID_STATES[@]}"; do
    if [[ "$state" == "$valid" ]]; then
      return 0
    fi
  done
  return 1
}

# ─── Lifecycle Pattern ────────────────────────────────────────────────────────
#
# Matches: /* @lifecycle <STATE> — <reason> */
# State must be one of: ACTIVE, GENERATED, TEMPORARY, EXPERIMENTAL, ARCHIVED
#
# Also matches: // @lifecycle <STATE> — <reason> (single-line variant for JS/TS)
#
# The -- (em-dash) separator: \xe2\x80\x94 in UTF-8, or --- for ASCII fallback
# We accept both the Unicode em-dash and three ASCII hyphens.

LIFECYCLE_PATTERN='@lifecycle[[:space:]]+([A-Z]+)'

# ─── Validation ───────────────────────────────────────────────────────────────

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
FIX_COUNT=0

validate_file() {
  local file="$1"
  local fix_mode="$2"

  # Skip non-existent files
  if [[ ! -f "$file" ]]; then
    echo "  SKIP  $file (not found)"
    ((SKIP_COUNT++))
    return 0
  fi

  # Skip by extension
  if is_skip_extension "$file"; then
    echo "  SKIP  $file (binary extension)"
    ((SKIP_COUNT++))
    return 0
  fi

  # Skip by filename
  if is_skip_file "$file"; then
    echo "  SKIP  $file (excluded file)"
    ((SKIP_COUNT++))
    return 0
  fi

  # Skip .gitignore'd files (check if git knows about them)
  if git rev-parse --is-inside-work-tree &>/dev/null; then
    if ! git ls-files --error-unmatch "$file" &>/dev/null; then
      if git check-ignore -q "$file" &>/dev/null; then
        echo "  SKIP  $file (gitignored)"
        ((SKIP_COUNT++))
        return 0
      fi
    fi
  fi

  # Determine which line to check based on shebang
  local check_line
  local first_line
  first_line="$(head -n 1 "$file" 2>/dev/null || true)"

  if echo "$first_line" | grep -qE '^#!'; then
    # Shebang detected — check line 2
    check_line="$(sed -n '2p' "$file" 2>/dev/null || true)"
  else
    check_line="$first_line"
  fi

  # Check for lifecycle declaration
  if echo "$check_line" | grep -qE "$LIFECYCLE_PATTERN"; then
    local state
    state="$(echo "$check_line" | sed -nE "s/.*$LIFECYCLE_PATTERN.*/\1/p")"

    if is_valid_state "$state"; then
      echo "  PASS  $file ($state)"
      ((PASS_COUNT++))
      return 0
    else
      echo "  FAIL  $file (invalid state: $state)"
      ((FAIL_COUNT++))
      return 1
    fi
  else
    if [[ "$fix_mode" == "true" ]]; then
      # Check if file is new (untracked or staged new file)
      if git rev-parse --is-inside-work-tree &>/dev/null; then
        local status
        status="$(git status --porcelain "$file" 2>/dev/null | head -c 2 || true)"
        if [[ "$status" == "??" ]] || [[ "$status" == "A " ]] || [[ "$status" == "AM" ]]; then
          # Determine lifecycle comment style based on shebang
          local lifecycle_comment
          local file_content
          file_content="$(cat "$file" 2>/dev/null || true)"
          if echo "$first_line" | grep -qE '^#!'; then
            # Shell script — insert after shebang
            lifecycle_comment="# @lifecycle $DEFAULT_STATE — $DEFAULT_REASON"
            local tmpfile
            tmpfile="$(mktemp)"
            echo "$first_line" > "$tmpfile"
            echo "$lifecycle_comment" >> "$tmpfile"
            tail -n +2 "$file" >> "$tmpfile" 2>/dev/null || true
            mv "$tmpfile" "$file"
          else
            # Regular file — insert as first line
            lifecycle_comment="/* @lifecycle $DEFAULT_STATE — $DEFAULT_REASON */"
            local tmpfile
            tmpfile="$(mktemp)"
            echo "$lifecycle_comment" > "$tmpfile"
            # Preserve original newline after first line if it's empty
            if [[ -z "$(head -n 1 "$file" 2>/dev/null)" ]]; then
              # File starts with empty line — insert before it
              tail -n +1 "$file" >> "$tmpfile" 2>/dev/null || true
            else
              cat "$file" >> "$tmpfile" 2>/dev/null || true
            fi
            mv "$tmpfile" "$file"
          fi
          echo "  FIX   $file (inserted @lifecycle $DEFAULT_STATE — $DEFAULT_REASON)"
          ((FIX_COUNT++))
          return 0
        fi
      fi
      echo "  FAIL  $file (no lifecycle declaration, --fix skipped — file is not new)"
      ((FAIL_COUNT++))
      return 1
    else
      echo "  FAIL  $file (no lifecycle declaration)"
      ((FAIL_COUNT++))
      return 1
    fi
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
  local fix_mode="false"
  local files=()

  # Parse arguments
  for arg in "$@"; do
    if [[ "$arg" == "--fix" ]]; then
      fix_mode="true"
    else
      files+=("$arg")
    fi
  done

  # If no files specified, use git diff (staged files) or cwd
  if [[ ${#files[@]} -eq 0 ]]; then
    if git rev-parse --is-inside-work-tree &>/dev/null; then
      # Get staged new/modified files
      while IFS= read -r line; do
        files+=("$line")
      done < <(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
      # Also include untracked files
      while IFS= read -r line; do
        files+=("$line")
      done < <(git ls-files --others --exclude-standard 2>/dev/null || true)
    fi

    # If still empty, scan all tracked files (baseline check)
    if [[ ${#files[@]} -eq 0 ]]; then
      echo "  INFO  No files specified and no git changes detected."
      echo "  INFO  Run with explicit file paths or stage files first."
      exit 0
    fi
  fi

  echo "─── Lifecycle Declaration Validator ───"
  echo ""

  local exit_code=0
  for f in "${files[@]}"; do
    validate_file "$f" "$fix_mode" || exit_code=1
  done

  echo ""
  echo "─── Summary ───"
  echo "  Pass:  $PASS_COUNT"
  echo "  Fail:  $FAIL_COUNT"
  echo "  Skip:  $SKIP_COUNT"
  if [[ "$fix_mode" == "true" ]]; then
    echo "  Fixed: $FIX_COUNT"
  fi
  echo ""

  return $exit_code
}

main "$@"
