# Static scan security boundary

AgentCheck treats a target repository as untrusted input. `scan` does not execute package scripts, import target modules, invoke a shell, access the network, or write into the target.

## Traversal

- The root is resolved to a real directory before traversal.
- Symbolic links and directory junctions are reported and never followed.
- Depth, file count, individual readable size, total bytes, and elapsed traversal time are bounded.
- Generated and dependency directories are excluded before recursion.
- Ignore patterns operate only on normalized repository-relative paths.

## Parsing

- Manifests and configuration are parsed as inert JSON.
- `.agentcheck.json` is capped at 256 KiB, 1,000 ignore patterns, and 256 characters per pattern.
- Documentation, workflow, and source inspection consume text only when the traversal snapshot marks content readable.
- Commands are normalized for evidence comparison but never passed to a process or shell.

## Regression coverage

The test suite covers symlink escape, file-count and byte limits, oversized files, oversized configuration, malformed configuration, frozen schema compatibility, and package execution from the produced npm tarball. The CI matrix runs the packaged smoke test on Windows, macOS, and Linux.
