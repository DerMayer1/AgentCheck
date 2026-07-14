# AgentCheck implementation roadmap

## Phase 0 — Architecture lock

Status: complete.

Deliverables:

- product and non-goal contract;
- CLI command contract;
- core domain contracts;
- scoring semantics;
- initial rule catalog;
- read-only safety boundary;
- fixture strategy.

Exit criteria:

- no unresolved decision changes the public JSON shape or scan safety model;
- the first vertical slice is selected;
- version 0.1 scope fits one npm package.

## Phase 1 — Walking skeleton

Status: complete.

Deliverables:

- strict TypeScript npm package;
- `agentcheck scan [path]`;
- repository root validation;
- bounded deterministic traversal;
- empty fact set and rule registry;
- terminal and JSON reporters;
- defined exit codes;
- unit and integration test harness.

Exit criteria:

- `scan` runs through `npx` packaging locally;
- fixture order does not change output order;
- paths are portable across Windows, macOS, and Linux;
- malformed input produces a domain error, not a stack trace.

## Phase 2 — Evidence vertical slice

Status: complete.

Deliverables:

- Node/package-manager detection;
- workspace discovery;
- package-script extraction;
- GitHub Actions command extraction;
- README and `AGENTS.md` command extraction;
- AC-ENV-001, AC-ENV-003, AC-VER-001, AC-VER-003, AC-VER-004, and AC-INT-001;
- score aggregation by applicability.

Exit criteria:

- one fixture demonstrates a documented command that exists;
- one demonstrates documentation/manifest divergence;
- one demonstrates CI/local divergence;
- every finding points to concrete evidence;
- JSON output passes its shipped schema.

## Phase 3 — Version 0.1 rule set

Status: complete.

Deliverables:

- 15–18 high-confidence deterministic rules;
- `.agentcheck.json` validation;
- severity and score gates;
- `explain` and `rules` commands;
- golden output tests;
- self-scan in CI.

Exit criteria:

- no rule relies only on a filename when content correlation is feasible;
- every rule has pass, fail, skip, malformed, and boundary coverage;
- scans require no network, API key, or account;
- the tool performs no target-repository writes or code execution.

## Phase 4 — Release hardening

Status: next.

Deliverables:

- packaged executable smoke tests on Windows, macOS, and Linux;
- performance fixtures;
- JSON schema compatibility tests;
- security review of traversal and parser boundaries;
- concise README demonstration;
- npm provenance and release workflow.

Exit criteria:

- performance targets have measured results;
- symlink escape and oversized-repository fixtures pass;
- npm tarball contents are reviewed;
- the 20-second terminal demo uses a real fixture and reproducible output.

## Explicitly deferred

- `agentcheck verify` command execution;
- `agentcheck fix` or file generation;
- SARIF output;
- HTML output;
- hosted reports and badges;
- agent battles;
- LLM analysis;
- additional language rule packs.

Deferred capabilities require a new architecture decision rather than silently expanding `scan`.
