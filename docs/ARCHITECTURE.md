# AgentCheck architecture

## 1. Scope

AgentCheck answers one question:

> Can a coding agent understand this repository, identify a safe change path, and determine how that change should be verified without guessing?

Version 0.1 is a local CLI for Node.js and TypeScript repositories. It performs bounded static inspection and emits terminal or JSON results. It has no web application, daemon, database, login, telemetry, LLM, or required network access.

## 2. Non-goals for version 0.1

- Running autonomous coding agents.
- Comparing models or agent vendors.
- Editing repository files.
- Generating a public badge or hosted report.
- Performing general-purpose SAST, dependency vulnerability scanning, or code-quality analysis.
- Supporting every language or build system.
- Inferring subjective architectural quality from source code.

## 3. Architectural principles

### Evidence before score

The primary output is a set of findings backed by evidence. The score summarizes those findings; it is not an independent judgment.

### Facts before rules

Filesystem and manifest inspection produce normalized facts. Rules consume those facts. Rules do not traverse the repository directly.

### Read-only by default

`agentcheck scan` may read files and metadata but must not:

- execute package scripts;
- load JavaScript or TypeScript configuration from the target repository;
- install dependencies;
- invoke Git hooks;
- follow symbolic links outside the repository;
- write files inside the target repository;
- make network requests.

### Bounded work

Traversal has explicit limits for file count, bytes read, individual file size, depth, and duration. A limit produces a visible partial-analysis finding instead of silent truncation.

### Stable contracts

Rule identifiers, JSON output, exit codes, and score semantics are public API. Human-facing terminal decoration is not.

## 4. Runtime and packaging

- Language: TypeScript in strict mode.
- Runtime: Node.js `>=22.12`.
- Distribution: one npm package named `agentcheck` with a `bin` entry.
- Module format: ESM.
- Initial repository shape: one package, not a monorepo.
- Configuration: declarative JSON only; executable config is prohibited in the MVP.

Node 22 and 24 are supported LTS lines at the time of this decision. Requiring `22.12` also matches the current Commander runtime floor.

Expected production dependencies should remain small:

- command parsing;
- schema validation;
- gitignore-compatible matching;
- terminal color.

Repository analysis and scoring remain owned by AgentCheck rather than delegated to opaque third-party analyzers.

## 5. Component map

```text
CLI adapter
   |
   v
Scan application service
   |
   +--> Repository boundary and traversal limits
   |
   +--> Detectors --------> normalized facts
   |                            |
   |                            v
   +----------------------> Rule engine
                                |
                                v
                           Findings
                                |
                     +----------+----------+
                     v                     v
                 Scoring              Reporters
                                        |   |
                                   terminal JSON
```

### CLI adapter

Parses arguments, resolves the repository root, chooses a reporter, maps domain errors to exit codes, and writes to stdout/stderr. It contains no detection or scoring logic.

### Scan application service

Coordinates one immutable scan. It builds the repository snapshot, runs applicable detectors, evaluates rules, calculates scores, and returns a `ScanResult`.

### Repository boundary

Owns all target-filesystem access. It normalizes paths to repository-relative POSIX-style strings, enforces traversal limits, ignores excluded directories, and prevents symlink escape.

### Detectors

Convert repository evidence into facts such as:

- detected ecosystem and package manager;
- package manifests and workspace boundaries;
- declared scripts;
- CI workflow commands;
- instruction files and documented commands;
- test frameworks and test-file presence;
- environment variable declarations;
- migration tooling;
- potentially destructive commands.

Detectors do not assign scores or produce recommendations.

### Rule engine

Evaluates facts against independently testable rules. A rule declares its applicability, category, maximum points, and evaluation function.

### Scoring

Aggregates applicable rule results. Rules that are not applicable do not reduce the score. Low-confidence observations become review findings and are excluded from scoring.

### Reporters

Render the same `ScanResult` without changing it. Version 0.1 supports terminal and JSON. CI mode is terminal or JSON plus threshold-based exit behavior, not a separate analysis mode.

## 6. Suggested source layout

```text
src/
  cli/
    main.ts
    commands/
    exit-codes.ts
  application/
    scan-repository.ts
  repository/
    repository-reader.ts
    traversal-policy.ts
    path-policy.ts
  detectors/
    project-detector.ts
    package-detector.ts
    ci-detector.ts
    instruction-detector.ts
    test-detector.ts
    environment-detector.ts
    safety-detector.ts
  rules/
    registry.ts
    context/
    verification/
    environment/
    safety/
    integrity/
  scoring/
    score.ts
  reporters/
    terminal-reporter.ts
    json-reporter.ts
  config/
    schema.ts
    load-config.ts
  domain/
    facts.ts
    evidence.ts
    finding.ts
    scan-result.ts
tests/
  unit/
  integration/
  golden/
  fixtures/
```

Package splitting is deferred until another independently versioned rule pack or runtime actually exists.

## 7. Core contracts

Conceptual TypeScript contracts:

```ts
type RuleStatus = "pass" | "fail" | "warn" | "skip" | "error";
type Severity = "critical" | "high" | "medium" | "low" | "info";
type Confidence = "high" | "medium" | "low";

interface Evidence {
  kind: "file" | "manifest" | "script" | "workflow" | "derived";
  path?: string;
  line?: number;
  message: string;
}

interface Finding {
  ruleId: string;
  category: Category;
  status: RuleStatus;
  severity: Severity;
  confidence: Confidence;
  title: string;
  impact: string;
  recommendation?: string;
  evidence: Evidence[];
  earnedPoints: number;
  maxPoints: number;
}

interface ScanResult {
  schemaVersion: "1";
  toolVersion: string;
  complete: boolean;
  repository: RepositoryIdentity;
  profile: RepositoryProfile;
  findings: Finding[];
  scores: ScoreSummary;
  limitations: AnalysisLimitation[];
  durationMs: number;
}
```

The JSON schema is versioned independently from the npm package. Breaking JSON changes require a schema-version change.

## 8. Scan pipeline

1. Parse CLI arguments without touching the target.
2. Resolve and validate the repository root.
3. Load `.agentcheck.json` if present as inert JSON.
4. Construct traversal and resource limits.
5. Discover repository structure and project boundaries.
6. Run detectors once and build an immutable fact set.
7. Select applicable rules for the detected ecosystem.
8. Evaluate rules without additional filesystem access.
9. Calculate category and overall scores.
10. Render the selected output format.
11. Apply CI threshold semantics to the exit code.

## 9. Configuration

The MVP configuration file is `.agentcheck.json`:

```json
{
  "$schema": "https://agentcheck.dev/schema/config-v1.json",
  "ignore": ["examples/legacy/**"],
  "rules": {
    "AC-CTX-002": "off",
    "AC-VER-003": "warn"
  },
  "limits": {
    "maxFiles": 50000,
    "maxFileBytes": 1048576,
    "maxTotalBytes": 52428800
  }
}
```

Rules may be disabled or have enforcement changed, but their evidence and scoring meaning cannot be redefined by configuration.

The published schema URL is future-facing. No hosted service is needed for AgentCheck to operate; the schema must also ship inside the npm package.

## 10. Scoring model

| Category | Weight |
|---|---:|
| Verification reliability | 30% |
| Environment reproducibility | 25% |
| Operational safety | 20% |
| Context discoverability | 15% |
| Instruction integrity | 10% |

Within a category:

```text
category score = earned applicable points / maximum applicable points
overall score = weighted sum of category scores
```

Rules marked `skip` are not applicable. Rules marked `error` do not silently become failures; the scan records a limitation and CI may be configured to reject incomplete analysis.

Confidence does not numerically discount a result. A rule must have high or medium confidence to affect scoring; low-confidence results are advisory.

## 11. Output and exit codes

Stdout contains the requested report. Stderr contains diagnostics about AgentCheck itself.

| Code | Meaning |
|---:|---|
| 0 | Scan completed and any requested gate passed |
| 1 | Scan completed but score or severity gate failed |
| 2 | Invalid CLI usage or configuration |
| 3 | Repository could not be analyzed completely |
| 4 | Internal AgentCheck failure |

JSON output must remain valid even when a policy gate fails; the process exits `1` after emitting the result.

## 12. Safety boundary for future execution

Static inspection can prove consistency, but not that commands work. A later command may add explicit execution:

```text
agentcheck verify [path]
```

`verify` is architecturally separate from `scan` and must require explicit invocation. Its minimum controls are:

- no shell interpolation when direct process execution is possible;
- visible command plan before execution;
- per-command and total timeout;
- output and process-count limits;
- clean environment allowlist;
- no deployment, publish, migration-apply, or production commands;
- no network by default;
- user confirmation for commands not classified as safe;
- structured execution evidence in the result.

`verify` is not part of version 0.1.

## 13. Testing strategy

### Unit tests

Every detector, rule, scoring branch, path policy, and reporter is tested independently.

### Fixture repositories

Small repositories model one fact at a time: missing lockfile, divergent CI commands, undocumented environment variables, unsafe scripts, monorepo boundaries, malformed manifests, and symlink escape attempts.

### Golden tests

Terminal and JSON outputs are snapshot-tested against versioned fixtures. Intentional output changes require explicit golden updates.

### Dogfooding

Once the first usable build exists, AgentCheck scans its own repository in CI. Self-scanning is an additional acceptance test, not a replacement for fixtures.

## 14. Performance targets

For a repository with 10,000 tracked files on a warm filesystem:

- first terminal output within 250 ms;
- complete static scan target below 2 seconds;
- peak memory target below 150 MB;
- each relevant file read at most once;
- deterministic ordering independent of filesystem enumeration order.

Targets are measured and revised with real fixtures; they are not release claims until benchmarked.
