import { readFile } from "node:fs/promises";
import path from "node:path";

import type { RepositorySnapshot } from "../domain/types.js";

export interface TextReadResult {
  path: string;
  content?: string;
  error?: string;
}

export class TextFileStore {
  readonly #filesByPath: Map<string, { contentReadable: boolean }>;
  readonly #cache = new Map<string, Promise<TextReadResult>>();

  public constructor(private readonly snapshot: RepositorySnapshot) {
    this.#filesByPath = new Map(
      snapshot.files.map((file) => [
        file.path,
        { contentReadable: file.contentReadable },
      ]),
    );
  }

  public read(repositoryPath: string): Promise<TextReadResult> {
    const cached = this.#cache.get(repositoryPath);
    if (cached !== undefined) {
      return cached;
    }

    const pending = this.#read(repositoryPath);
    this.#cache.set(repositoryPath, pending);
    return pending;
  }

  async #read(repositoryPath: string): Promise<TextReadResult> {
    const file = this.#filesByPath.get(repositoryPath);
    if (file === undefined) {
      return { path: repositoryPath, error: "File is not part of the repository snapshot." };
    }

    if (!file.contentReadable) {
      return {
        path: repositoryPath,
        error: "File exceeds the configured content-read limit.",
      };
    }

    const absolutePath = path.resolve(
      this.snapshot.root,
      ...repositoryPath.split("/"),
    );
    const relativeCheck = path.relative(this.snapshot.root, absolutePath);
    if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
      return { path: repositoryPath, error: "Path escapes the repository root." };
    }

    try {
      return {
        path: repositoryPath,
        content: await readFile(absolutePath, "utf8"),
      };
    } catch (error) {
      return {
        path: repositoryPath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
