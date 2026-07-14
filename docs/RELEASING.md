# Releasing AgentCheck

Publishing is tag-driven and uses npm trusted publishing with GitHub Actions OIDC. No long-lived npm token belongs in the repository.

## One-time npm setup

Create a trusted publisher for package `agentcheck` with:

- repository: `DerMayer1/AgentCheck`;
- workflow: `release.yml`;
- environment: `npm`.

The package name was unclaimed in the npm registry when version 0.1.0 was prepared. Confirm availability again immediately before the first publish.

## Release sequence

1. Update `package.json` and `package-lock.json` to the same version.
2. Run `npm ci`, `npm run verify`, `npm run benchmark`, and `npm run smoke:package`.
3. Commit and push the release candidate to `main`.
4. Create and push a matching tag, for example `v0.1.0`.

The release workflow rejects a tag that does not exactly match the package version, reruns verification and the tarball smoke test, then invokes `npm publish --access public --provenance`. GitHub's `npm` environment can be configured with required reviewers for a manual publication gate.
