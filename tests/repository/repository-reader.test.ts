import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_TRAVERSAL_LIMITS,
  readRepository,
} from "../../src/repository/repository-reader.js";

const temporaryDirectories: string[] = [];

async function createRepository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "agentcheck-reader-"));
  temporaryDirectories.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("readRepository", () => {
  it("returns deterministic repository-relative paths and skips generated directories", async () => {
    const root = await createRepository();
    await mkdir(path.join(root, "src"));
    await mkdir(path.join(root, "node_modules", "ignored"), { recursive: true });
    await writeFile(path.join(root, "z.txt"), "z");
    await writeFile(path.join(root, "src", "a.ts"), "export {};\n");
    await writeFile(path.join(root, "node_modules", "ignored", "index.js"), "ignored");

    const snapshot = await readRepository(root);

    expect(snapshot.files.map((file) => file.path)).toEqual(["src/a.ts", "z.txt"]);
    expect(snapshot.totalBytes).toBe(12);
    expect(snapshot.limitations).toEqual([]);
  });

  it("stops at the file limit and reports incomplete analysis", async () => {
    const root = await createRepository();
    await writeFile(path.join(root, "a.txt"), "a");
    await writeFile(path.join(root, "b.txt"), "b");

    const snapshot = await readRepository(root, {
      ...DEFAULT_TRAVERSAL_LIMITS,
      maxFiles: 1,
    });

    expect(snapshot.files).toHaveLength(1);
    expect(snapshot.limitations).toContainEqual(
      expect.objectContaining({
        code: "MAX_FILES_EXCEEDED",
        affectsCompleteness: true,
      }),
    );
  });

  it("rejects a target that is not a directory", async () => {
    const root = await createRepository();
    const file = path.join(root, "package.json");
    await writeFile(file, "{}");

    await expect(readRepository(file)).rejects.toMatchObject({
      code: "REPOSITORY_ACCESS_ERROR",
    });
  });
});
