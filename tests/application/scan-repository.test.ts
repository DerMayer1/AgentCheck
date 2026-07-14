import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { scanRepository } from "../../src/application/scan-repository.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("scanRepository", () => {
  it("builds a complete scan result", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentcheck-scan-"));
    temporaryDirectories.push(root);
    await mkdir(path.join(root, ".git"));
    await writeFile(path.join(root, "package.json"), "{}\n");

    const result = await scanRepository(root, { toolVersion: "test" });

    expect(result).toMatchObject({
      schemaVersion: "1",
      toolVersion: "test",
      complete: true,
      repository: {
        name: path.basename(root),
        gitRepository: true,
      },
      profile: {
        ecosystems: ["node"],
        packageManagers: [],
        workspace: false,
        fileCount: 1,
        totalBytes: 3,
      },
      scores: {
        overall: expect.any(Number),
      },
      limitations: [],
    });
    expect(result.findings).toHaveLength(18);
    expect(result.scores.categories).toHaveLength(5);
  });
});
