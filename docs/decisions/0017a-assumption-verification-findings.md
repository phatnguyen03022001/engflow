/* @lifecycle ACTIVE — Findings: ADR-017 Assumption Verification Empirically Falsified */

# ADR-017 Assumption Verification Findings

**Date:** 2026-06-10
**Method:** Isolated canary test (TASK-TEST-POST-VERIFY-BASH)
**Verdict:** BASH_IS_WORKING

---

## Configuration Under Test

| Parameter | Value | Source |
|-----------|-------|--------|
| POST_VERIFY mode | `primary` | `.kilo/kilo.jsonc` line 240 |
| POST_VERIFY bash | `allow` | `.kilo/kilo.jsonc` line 250 |
| POST_VERIFY edit | `deny` | `.kilo/kilo.jsonc` line 250 |
| Platform | `@kilocode/plugin` v7.3.40 | `.kilo/package-lock.json` |
| Agent session type | Primary session (not sub-task) | Inferred from `mode: primary` |

---

## Test Protocol

**Execution flow:** CODE → POST_VERIFY (direct handoff, per CTO Amendment #3)

**Commands executed by POST_VERIFY:**
```bash
echo "NATIVE_BASH_TEST_SUCCESS"
node -e "console.log('Runtime Node.js execution: OK')"
npm run lint -- --help
```

**Success criteria:** All three commands complete with exit code 0.

---

## Empirical Result

### VERDICT: BASH_IS_WORKING

### Exit Code: 0

All three commands executed successfully. No permission errors, no platform blocks, no timeout.

### RAW OUTPUT

```
NATIVE_BASH_TEST_SUCCESS
Runtime Node.js execution: OK

> @floweng/backend@1.0.0 lint
> eslint "{src,test}/**/*.ts" --help

eslint [options] file.js [file.js] [dir]

Basic configuration:
  --no-eslintrc                    Disable use of configuration from .eslintrc.*
  -c, --config path::String        Use this configuration, overriding .eslintrc.* config options if present
  --env [String]                   Specify environments
  --ext [String]                   Specify JavaScript file extensions
  --global [String]                Define global variables
  --parser String                  Specify the parser to be used
  --parser-options Object          Specify parser options
  --resolve-plugins-relative-to path::String  A folder where plugins should be resolved from, CWD by default

Specify Rules and Plugins:
  --plugin [String]                Specify plugins
  --rule Object                    Specify rules
  --rulesdir [path::String]        Load additional rules from this directory. Deprecated: Use rules from plugins

Fix Problems:
  --fix                            Automatically fix problems
  --fix-dry-run                    Automatically fix problems without saving the changes to the file system
  --fix-type Array                 Specify the types of fixes to apply (directive, problem, suggestion, layout)

Ignore Files:
  --ignore-path path::String       Specify path of ignore file
  --no-ignore                      Disable use of ignore files and patterns
  --ignore-pattern [String]        Pattern of files to ignore (in addition to those in .eslintrc)

Use stdin:
  --stdin                          Lint code provided on <STDIN> - default: false
  --stdin-filename String          Specify filename to process STDIN as

Handle Warnings:
  --quiet                          Report errors only - default: false
  --max-warnings Int               Number of warnings to trigger nonzero exit code - default: -1

Output:
  -o, --output-file path::String   Specify file to write report to
  -f, --format String              Use a specific output format - default: stylish
  --color, --no-color              Force enabling/disabling of color

Inline configuration comments:
  --no-inline-config               Prevent comments from changing config or rules
  --report-unused-disable-directives  Adds reported errors for unused eslint-disable and eslint-enable directives
  --report-unused-disable-directives-severity String  Chooses severity level for reporting unused eslint-disable and eslint-enable directives - either: off, warn, error, 0, 1, or 2

Caching:
  --cache                          Only check changed files - default: false
  --cache-file path::String        Path to the cache file. Deprecated: use --cache-location - default: .eslintcache
  --cache-location path::String    Path to the cache file or directory
  --cache-strategy String          Strategy to use for detecting changed files in the cache - either: metadata or content - default: metadata

Miscellaneous:
  --init                           Run config initialization wizard - default: false
  --env-info                       Output execution environment information - default: false
  --no-error-on-unmatched-pattern  Prevent errors when pattern is unmatched
  --exit-on-fatal-error            Exit with exit code 2 in case of fatal error - default: false
  --debug                          Output debugging information
  -h, --help                       Show help
  -v, --version                    Output the version number
  --print-config path::String      Print the configuration for the given file
```

---

## Implication

ADR-017's core premise — as stated in its Context section — is:

> *"The Kilo platform (`@kilocode/plugin` v7.3.40) blocks POST_VERIFY bash execution despite `"bash": "allow"` in `kilo.jsonc` — the platform applies different permission resolution for sub-task dispatch (POST_VERIFY) vs. top-level sessions (CODE)."*

This premise is **empirically falsified**:

| ADR-017 Claim | Finding | Evidence |
|---------------|---------|----------|
| POST_VERIFY is a "sub-task agent" | False — POST_VERIFY is `mode: primary` | `.kilo/kilo.jsonc` line 240 |
| Platform blocks sub-task bash | False — bash executed with exit 0 | Raw output above |
| `bash: allow` is ineffective for POST_VERIFY | False — `bash: allow` is fully functional | Three commands succeeded |
| Runtime verification must move to CODE | Not justified — POST_VERIFY can execute it natively | Canary test proof |

The root cause of this error is that **no one empirically tested** whether POST_VERIFY could execute bash before creating ADR-017. The assumption was treated as fact without verification.

### Configuration Discovery

The static audit revealed a configuration contradiction that the plan itself missed:
- ADR-017 §4.B (Alternatives Considered) stated POST_VERIFY "cannot be the primary session agent"
- Yet `.kilo/kilo.jsonc` line 240 already has `"mode": "primary"` for POST_VERIFY
- The only agent with `"mode": "subagent"` in the entire system is DEBUG (line 189)

This configuration contradiction should have been caught during ADR-017's architecture review.

---

## Recommendation

1. **Supersede ADR-017** with ADR-018 that reverts runtime verification execution back to POST_VERIFY, restoring the ADR-015 pattern.
2. **Remove the "CODE executes verification" instructions** from CODE's prompt in `kilo.jsonc`.
3. **Restore POST_VERIFY's runtime verification instructions** — replace the current "audit CODE's report" language with direct build/lint/test execution per ADR-015 §4.
4. **Keep `edit: deny` unchanged** — POST_VERIFY must never modify code.
5. **Keep `bash: allow` unchanged** — it already works and is correctly configured.
6. **Update ADR-017's status** to `Superseded` in the decision index.

---

## References

- ADR-017: Runtime Verification Relocation to CODE Agent (`0017-execution-shift-to-code.md`)
- ADR-015: Runtime Verification Integration (`0015-runtime-verification-post-verify.md`)
- Plan: ADR-017 Assumption Verification (`.kilo/plans/adr-017-assumption-verification.md`)
- Canary test raw output: captured above
- Configuration: `.kilo/kilo.jsonc` lines 236-253

---

*End of Findings*
