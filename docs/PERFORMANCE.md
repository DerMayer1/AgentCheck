# Performance contract

AgentCheck measures only static traversal, fact detection, rule evaluation, scoring, and report construction. Fixture creation is outside the timed section.

The release benchmark generates 2,500 TypeScript files plus one manifest and requires a complete scan in at most 5,000 ms:

```text
npm run build
npm run benchmark
{"files":2501,"bytes":75394,"elapsedMs":2118,"targetMs":5000}
```

Baseline measured on 2026-07-14 on Windows with Node.js 22.12. The elapsed value is informational and varies by filesystem; the 5-second ceiling is enforced in Linux CI. Default production limits remain 50,000 files, 50 MiB total input, 1 MiB per readable file, and 10 seconds traversal time.
