# AgentCheck version 0 rule catalog

This catalog defines the initial rule-design surface. A rule only enters the runtime after its fixtures, evidence format, applicability behavior, and scoring points are specified.

Runtime status: AC-ENV-001, AC-ENV-003, AC-VER-001, AC-VER-003, AC-VER-004, and AC-INT-001 are implemented in the Phase 2 evidence slice.

## Rule result requirements

Every rule must provide:

- a stable identifier;
- a factual title;
- applicability conditions;
- deterministic evaluation logic;
- one or more evidence records;
- impact stated in agent behavior terms;
- an actionable recommendation;
- severity, confidence, and score points;
- passing, failing, skipped, malformed-input, and boundary fixtures.

## Context discoverability — 15%

| ID | Rule | Initial intent |
|---|---|---|
| AC-CTX-001 | Repository overview is discoverable | A root README or equivalent identifies the project and its development entry point. |
| AC-CTX-002 | Agent instructions are present | Detect `AGENTS.md` and supported agent-specific instruction files without requiring all of them. |
| AC-CTX-003 | Architecture entry points are documented | Documentation points to meaningful source or package boundaries rather than merely using an architecture heading. |
| AC-CTX-004 | Monorepo scopes have local guidance | Large independent workspaces can expose scoped instructions; this is skipped for single-package repositories. |

## Verification reliability — 30%

| ID | Rule | Initial intent |
|---|---|---|
| AC-VER-001 | Test command is declared | A package script or documented command identifies how tests run. |
| AC-VER-002 | Test files are discoverable | Detected test tooling has corresponding test files or an explicit external-test explanation. |
| AC-VER-003 | Canonical verification command exists | One command composes the checks expected before declaring a change complete. |
| AC-VER-004 | CI and local verification agree | CI uses the canonical command or an equivalent normalized command sequence. |
| AC-VER-005 | Type checking is independently available | TypeScript projects expose an explicit no-emit type-check path. |
| AC-VER-006 | Build and test failures are not suppressed | Validation commands do not hide failures using unconditional success patterns. |

## Environment reproducibility — 25%

| ID | Rule | Initial intent |
|---|---|---|
| AC-ENV-001 | Dependency resolution is locked | Exactly one coherent package-manager lock strategy is present. |
| AC-ENV-002 | Runtime version is constrained | `engines`, `.nvmrc`, `.node-version`, Volta, or equivalent defines a usable Node range. |
| AC-ENV-003 | Package-manager choice is unambiguous | Manifest metadata, lockfiles, docs, and CI do not disagree about npm, pnpm, Yarn, or Bun. |
| AC-ENV-004 | Required environment variables are documented | Referenced variables can be discovered through examples, schemas, or setup documentation without exposing values. |
| AC-ENV-005 | Setup instructions match repository state | Documented installation commands correspond to the detected package manager and workspace layout. |

## Operational safety — 20%

| ID | Rule | Initial intent |
|---|---|---|
| AC-SAFE-001 | Production operations are clearly separated | Deploy, publish, release, and production commands are identifiable and not presented as routine validation. |
| AC-SAFE-002 | Destructive data commands are guarded | Reset, drop, truncate, force, and migration-apply commands have explicit scope or warning evidence. |
| AC-SAFE-003 | Lifecycle scripts are visible | Install lifecycle scripts and their direct command chains are surfaced as execution-risk evidence. |
| AC-SAFE-004 | Instruction files avoid unsafe blanket permission | Instructions do not tell agents to bypass confirmations or execute arbitrary commands globally. |

## Instruction integrity — 10%

| ID | Rule | Initial intent |
|---|---|---|
| AC-INT-001 | Documented package scripts exist | Script names referenced by instructions or contributing docs exist in the relevant manifest. |
| AC-INT-002 | Referenced local paths exist | Important paths named by repository instructions resolve within the expected scope. |
| AC-INT-003 | Generated files have a modification policy | Detected generated artifacts have a documented source or regeneration command. |
| AC-INT-004 | Migration workflow is documented when applicable | Repositories with detected migration tooling explain creation and safe application boundaries. |

## MVP cut line

The catalog contains 23 candidates. Version 0.1 should ship the first 15–18 whose deterministic behavior is strongest. Rule count is not a quality metric.

The most valuable vertical slice is:

1. package-manager and workspace detection;
2. scripts and CI command extraction;
3. documentation command extraction;
4. cross-checking those three sources;
5. terminal and JSON evidence.

This slice validates AgentCheck's differentiation: internal consistency across real repository evidence rather than file-presence scoring.
