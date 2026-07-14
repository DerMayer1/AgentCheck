import { access } from "node:fs/promises";
import path from "node:path";

import type { ScanResult } from "../domain/types.js";
import {
  DEFAULT_TRAVERSAL_LIMITS,
  readRepository,
  type TraversalLimits,
} from "../repository/repository-reader.js";
import { createEmptyScore } from "../scoring/empty-score.js";

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

  const repositoryName = path.basename(snapshot.root);
  const complete = snapshot.limitations.every(
    (limitation) => !limitation.affectsCompleteness,
  );

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
      ecosystems: [],
      fileCount: snapshot.files.length,
      totalBytes: snapshot.totalBytes,
    },
    findings: [],
    scores: createEmptyScore(),
    limitations: snapshot.limitations,
    durationMs: Math.round(performance.now() - startedAt),
  };
}
