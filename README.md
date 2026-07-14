# AgentCheck

AgentCheck is a local, deterministic CLI that evaluates whether a repository gives AI coding agents enough context, reproducibility, verification, and operational safety to make reliable changes.

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
agentcheck scan --ci --min-score 70
```

The first release targets Node.js and TypeScript repositories. Other ecosystems are extensions, not MVP requirements.

## Development

```text
npm install
npm run verify
npm run dev -- scan .
```

`npm run verify` is the canonical local validation command and runs type checking, tests, and the production build.

## Status

Phase 2 evidence slice. The CLI detects Node.js repositories, package managers, workspaces, package scripts, documented commands, and GitHub Actions commands. Six deterministic rules produce evidence-backed findings and a real score.

See:

- [Architecture](docs/ARCHITECTURE.md)
- [Initial rule catalog](docs/RULES_V0.md)
- [Implementation roadmap](docs/ROADMAP.md)
