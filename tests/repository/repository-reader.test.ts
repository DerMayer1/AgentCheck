import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
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

  it("does not follow a symlink that escapes the repository", async () => {
    const root = await createRepository();
    const outside = await createRepository();
    await writeFile(path.join(outside, "secret.txt"), "outside");
    await symlink(outside, path.join(root, "external"), process.platform === "win32" ? "junction" : "dir");

    const snapshot = await readRepository(root);

    expect(snapshot.files).toEqual([]);
    expect(snapshot.limitations).toContainEqual({
      code: "SYMLINK_SKIPPED",
      message: "Symbolic links are not followed during static scans.",
      path: "external",
      affectsCompleteness: false,
    });
  });

  it("halts before exceeding the total-byte limit", async () => {
    const root = await createRepository();
    await writeFile(path.join(root, "a.txt"), "12345");
    await writeFile(path.join(root, "b.txt"), "67890");

    const snapshot = await readRepository(root, { ...DEFAULT_TRAVERSAL_LIMITS, maxTotalBytes: 7 });

    expect(snapshot.totalBytes).toBe(5);
    expect(snapshot.files.map((file) => file.path)).toEqual(["a.txt"]);
    expect(snapshot.limitations).toContainEqual(expect.objectContaining({ code: "MAX_TOTAL_BYTES_EXCEEDED" }));
  });

  it("records oversized files without making their contents readable", async () => {
    const root = await createRepository();
    await writeFile(path.join(root, "large.txt"), "12345");

    const snapshot = await readRepository(root, { ...DEFAULT_TRAVERSAL_LIMITS, maxFileBytes: 4 });

    expect(snapshot.files).toEqual([{ path: "large.txt", size: 5, contentReadable: false }]);
  });
});
