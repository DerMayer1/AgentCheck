import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import { RepositoryAccessError } from "../domain/errors.js";
import type {
  AnalysisLimitation,
  RepositoryFile,
  RepositorySnapshot,
} from "../domain/types.js";

export interface TraversalLimits {
  maxDepth: number;
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  timeoutMs: number;
}

export const DEFAULT_TRAVERSAL_LIMITS: Readonly<TraversalLimits> = {
  maxDepth: 40,
  maxFiles: 50_000,
  maxFileBytes: 1_048_576,
  maxTotalBytes: 52_428_800,
  timeoutMs: 10_000,
};

const DEFAULT_EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

function toRepositoryPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function accessMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function readRepository(
  targetPath: string,
  limits: TraversalLimits = DEFAULT_TRAVERSAL_LIMITS,
  ignorePatterns: readonly string[] = [],
): Promise<RepositorySnapshot> {
  let root: string;

  try {
    root = await realpath(path.resolve(targetPath));
    const rootStat = await lstat(root);

    if (!rootStat.isDirectory()) {
      throw new RepositoryAccessError(`Target is not a directory: ${targetPath}`);
    }
  } catch (error) {
    if (error instanceof RepositoryAccessError) {
      throw error;
    }

    throw new RepositoryAccessError(
      `Cannot access repository at ${targetPath}: ${accessMessage(error)}`,
    );
  }

  const startedAt = Date.now();
  const files: RepositoryFile[] = [];
  const limitations: AnalysisLimitation[] = [];
  let totalBytes = 0;
  let halted = false;

  const ignored = (repositoryPath: string): boolean => ignorePatterns.some((pattern) => {
    const normalized = pattern.replace(/^\.\//, "").replace(/\\/g, "/").replace(/\/$/, "/**");
    const expression = normalized
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "\u0000")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]")
      .replace(/\u0000/g, ".*");
    const prefix = normalized.includes("/") ? "^" : "(^|.*/)";
    return new RegExp(`${prefix}${expression}(/.*)?$`).test(repositoryPath);
  });

  const addCompletenessLimit = (
    code: string,
    message: string,
    relativePath?: string,
  ): void => {
    if (limitations.some((limitation) => limitation.code === code)) {
      return;
    }

    limitations.push({
      code,
      message,
      affectsCompleteness: true,
      ...(relativePath === undefined ? {} : { path: relativePath }),
    });
  };

  const walk = async (directory: string, depth: number): Promise<void> => {
    if (halted) {
      return;
    }

    if (Date.now() - startedAt > limits.timeoutMs) {
      halted = true;
      addCompletenessLimit(
        "TRAVERSAL_TIMEOUT",
        `Repository traversal exceeded ${limits.timeoutMs}ms.`,
      );
      return;
    }

    if (depth > limits.maxDepth) {
      addCompletenessLimit(
        "MAX_DEPTH_EXCEEDED",
        `Repository traversal exceeded depth ${limits.maxDepth}.`,
        toRepositoryPath(path.relative(root, directory)),
      );
      return;
    }

    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      const relativeDirectory = toRepositoryPath(path.relative(root, directory));
      limitations.push({
        code: "DIRECTORY_UNREADABLE",
        message: accessMessage(error),
        path: relativeDirectory || ".",
        affectsCompleteness: true,
      });
      return;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));

    for (const entry of entries) {
      if (halted) {
        break;
      }

      const absoluteEntry = path.join(directory, entry.name);
      const relativeEntry = toRepositoryPath(path.relative(root, absoluteEntry));

      if (ignored(relativeEntry)) {
        continue;
      }

      if (entry.isSymbolicLink()) {
        limitations.push({
          code: "SYMLINK_SKIPPED",
          message: "Symbolic links are not followed during static scans.",
          path: relativeEntry,
          affectsCompleteness: false,
        });
        continue;
      }

      if (entry.isDirectory()) {
        if (!DEFAULT_EXCLUDED_DIRECTORIES.has(entry.name)) {
          await walk(absoluteEntry, depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (files.length >= limits.maxFiles) {
        halted = true;
        addCompletenessLimit(
          "MAX_FILES_EXCEEDED",
          `Repository contains more than ${limits.maxFiles} scannable files.`,
        );
        break;
      }

      let size: number;
      try {
        size = (await lstat(absoluteEntry)).size;
      } catch (error) {
        limitations.push({
          code: "FILE_UNREADABLE",
          message: accessMessage(error),
          path: relativeEntry,
          affectsCompleteness: true,
        });
        continue;
      }

      if (totalBytes + size > limits.maxTotalBytes) {
        halted = true;
        addCompletenessLimit(
          "MAX_TOTAL_BYTES_EXCEEDED",
          `Scannable files exceed ${limits.maxTotalBytes} total bytes.`,
        );
        break;
      }

      totalBytes += size;
      files.push({
        path: relativeEntry,
        size,
        contentReadable: size <= limits.maxFileBytes,
      });
    }
  };

  await walk(root, 0);

  return {
    root,
    files,
    totalBytes,
    limitations,
  };
}
