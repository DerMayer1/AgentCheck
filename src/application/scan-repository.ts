import { access } from "node:fs/promises";
import path from "node:path";

import { detectFacts } from "../detectors/detect-facts.js";
import type { ScanResult } from "../domain/types.js";
import {
  DEFAULT_TRAVERSAL_LIMITS,
  readRepository,
  type TraversalLimits,
} from "../repository/repository-reader.js";
import { evaluateRules } from "../rules/evaluate-rules.js";
import { calculateScore } from "../scoring/empty-score.js";

export interface ScanRepositoryOptions {
  toolVersion: string;
  limits?: TraversalLimits;
}

async function isGitRepository(root: string): Promise<boolean> {
  try {
    await access(path.join(root, ".git"));
    return true;
  } catch {
    return false;
  }
}

export async function scanRepository(
  targetPath: string,
  options: ScanRepositoryOptions,
): Promise<ScanResult> {
  const startedAt = performance.now();
  const snapshot = await readRepository(
    targetPath,
    options.limits ?? DEFAULT_TRAVERSAL_LIMITS,
  );
  const facts = await detectFacts(snapshot);
  const findings = evaluateRules(facts);
  const factLimitations = facts.limitations.map((limitation) => ({
    ...limitation,
    affectsCompleteness: true,
  }));
  const limitations = [...snapshot.limitations, ...factLimitations];

  const repositoryName = path.basename(snapshot.root);
  const complete = limitations.every(
    (limitation) => !limitation.affectsCompleteness,
  );
  const packageManagers = new Set<string>();
  for (const manifest of facts.manifests) {
    if (manifest.declaredPackageManager !== undefined) {
      packageManagers.add(manifest.declaredPackageManager);
    }
  }
  for (const lockfile of facts.lockfiles) {
    packageManagers.add(lockfile.packageManager);
  }

  return {
    schemaVersion: "1",
    toolVersion: options.toolVersion,
    complete,
    repository: {
      name: repositoryName,
      root: snapshot.root,
      gitRepository: await isGitRepository(snapshot.root),
    },
    profile: {
      ecosystems: facts.ecosystems,
      packageManagers: [...packageManagers].sort(),
      workspace: facts.workspace,
      fileCount: snapshot.files.length,
      totalBytes: snapshot.totalBytes,
    },
    findings,
    scores: calculateScore(findings),
    limitations,
    durationMs: Math.round(performance.now() - startedAt),
  };
}
