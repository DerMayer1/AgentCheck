# AgentCheck

AgentCheck is a local, deterministic CLI that evaluates whether a repository gives AI coding agents enough context, reproducibility, verification, and operational safety to make reliable changes.

## Install and scan

```bash
npm install --global agentcheck
agentcheck scan .
# or: npx agentcheck scan .
```

Twenty-second reproducible demo using the shipped coherent fixture:

```bash
npm run dev -- scan tests/fixtures/coherent
```

```text
AgentCheck 0.1.0

Repository  coherent
Files       7

AGENT READINESS  100/100
Verification   100/100
Environment    100/100
Safety         100/100
Context        100/100
Integrity      100/100

14 passed · 0 findings
```

## Product contract

```text
npx agentcheck scan
```

AgentCheck must be:

- CLI-only: no dashboard, account, backend, or hosted dependency.
- Local-first: repository contents never leave the machine.
- Deterministic by default: the same repository state and configuration produce the same result.
- Evidence-first: every result points to the files and facts that caused it.
- Read-only by default: `scan` never executes repository code or changes files.
- Agent-agnostic: results are useful for Codex, Claude Code, Copilot, Cursor, and similar tools.

## Initial command surface

```text
agentcheck scan [path]          Analyze a repository
agentcheck explain <rule-id>    Explain one rule and its remediation
agentcheck rules               List the installed rules
agentcheck --version            Print the CLI version
agentcheck --help               Print command help
```

Machine-readable operation is part of the core product:

```text
agentcheck scan --format json
agentcheck scan --ci --min-score 70 --fail-on high --fail-on-incomplete
```

Repository policy can be stored in `.agentcheck.json`:

```json
{
  "ignore": ["generated/**"],
  "rules": { "AC-CTX-002": "warn" },
  "limits": { "maxFiles": 25000 },
  "gates": { "minScore": 80, "failOn": "high", "failOnIncomplete": true }
}
```

Rule levels are `off`, `warn`, and `error`. CLI gate options override configured gates. Exit code 1 means a score gate failed, 3 means an explicitly gated incomplete analysis, and 5 means a severity gate failed.

The first release targets Node.js and TypeScript repositories. Other ecosystems are extensions, not MVP requirements.

## Development

```text
npm install
npm run verify
npm run dev -- scan .
```

`npm run verify` is the canonical local validation command and runs type checking, tests, and the production build.

## Status

Version 0.1 release candidate. AgentCheck evaluates 18 deterministic rules, validates `.agentcheck.json`, supports score/severity/completeness gates, and explains its rule catalog. Release hardening includes frozen output contracts, bounded-input security tests, a measured performance fixture, cross-platform tarball smoke tests, and npm provenance publishing. Scans remain local, static, read-only, and network-free.

See:

- [Architecture](docs/ARCHITECTURE.md)
- [Initial rule catalog](docs/RULES_V0.md)
- [Implementation roadmap](docs/ROADMAP.md)
- [Performance contract](docs/PERFORMANCE.md)
- [Static scan security boundary](docs/SECURITY.md)
- [Release procedure](docs/RELEASING.md)
