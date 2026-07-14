import path from "node:path";

import type {
  LockfileFact,
  PackageManifestFact,
  PackageManager,
} from "../domain/facts.js";
import type { RepositorySnapshot } from "../domain/types.js";
import type { TextFileStore } from "../repository/text-file-store.js";

interface PackageJsonShape {
  name?: unknown;
  scripts?: unknown;
  packageManager?: unknown;
  engines?: unknown;
  volta?: unknown;
  workspaces?: unknown;
}

function parseNodeConstraint(parsed: PackageJsonShape): string | undefined {
  if (typeof parsed.engines === "object" && parsed.engines !== null && "node" in parsed.engines) {
    const node = (parsed.engines as { node?: unknown }).node;
    if (typeof node === "string") {
      return node;
    }
  }
  if (typeof parsed.volta === "object" && parsed.volta !== null && "node" in parsed.volta) {
    const node = (parsed.volta as { node?: unknown }).node;
    if (typeof node === "string") {
      return node;
    }
  }
  return undefined;
}

const LOCKFILES: Readonly<Record<string, PackageManager>> = {
  "package-lock.json": "npm",
  "npm-shrinkwrap.json": "npm",
  "pnpm-lock.yaml": "pnpm",
  "yarn.lock": "yarn",
  "bun.lock": "bun",
  "bun.lockb": "bun",
};

function directoryOf(repositoryPath: string): string {
  const directory = path.posix.dirname(repositoryPath);
  return directory === "." ? "" : directory;
}

function parsePackageManager(value: unknown): PackageManager | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const manager = value.split("@")[0];
  return manager === "npm" || manager === "pnpm" || manager === "yarn" || manager === "bun"
    ? manager
    : undefined;
}

function parseScripts(value: unknown): Readonly<Record<string, string>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function parseWorkspaces(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "object" && value !== null && "packages" in value) {
    const packages = (value as { packages?: unknown }).packages;
    return Array.isArray(packages)
      ? packages.filter((item): item is string => typeof item === "string")
      : [];
  }

  return [];
}

export async function detectPackages(
  snapshot: RepositorySnapshot,
  textFiles: TextFileStore,
): Promise<{
  manifests: PackageManifestFact[];
  lockfiles: LockfileFact[];
  limitations: Array<{ code: string; message: string; path?: string }>;
}> {
  const limitations: Array<{ code: string; message: string; path?: string }> = [];
  const manifestPaths = snapshot.files
    .map((file) => file.path)
    .filter((filePath) => path.posix.basename(filePath) === "package.json")
    .sort();

  const manifests: PackageManifestFact[] = [];
  for (const manifestPath of manifestPaths) {
    const result = await textFiles.read(manifestPath);
    if (result.content === undefined) {
      limitations.push({
        code: "MANIFEST_UNREADABLE",
        message: result.error ?? "Manifest could not be read.",
        path: manifestPath,
      });
      continue;
    }

    try {
      const parsed = JSON.parse(result.content) as PackageJsonShape;
      const declaredPackageManager = parsePackageManager(parsed.packageManager);
      const nodeVersionConstraint = parseNodeConstraint(parsed);
      manifests.push({
        path: manifestPath,
        directory: directoryOf(manifestPath),
        ...(typeof parsed.name === "string" ? { name: parsed.name } : {}),
        scripts: parseScripts(parsed.scripts),
        ...(declaredPackageManager === undefined ? {} : { declaredPackageManager }),
        ...(nodeVersionConstraint === undefined ? {} : { nodeVersionConstraint }),
        workspacePatterns: parseWorkspaces(parsed.workspaces),
      });
    } catch (error) {
      limitations.push({
        code: "MANIFEST_INVALID_JSON",
        message: error instanceof Error ? error.message : String(error),
        path: manifestPath,
      });
    }
  }

  const lockfiles = snapshot.files
    .map((file) => file.path)
    .filter((filePath) => LOCKFILES[path.posix.basename(filePath)] !== undefined)
    .map((filePath) => ({
      path: filePath,
      packageManager: LOCKFILES[path.posix.basename(filePath)] as PackageManager,
    }))
    .sort((left, right) => left.path.localeCompare(right.path, "en"));

  return { manifests, lockfiles, limitations };
}
