import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../../src/cli/run.js";
import { EXIT_CODES } from "../../src/cli/exit-codes.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("runCli", () => {
  it("scans a repository and writes JSON", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentcheck-cli-"));
    temporaryDirectories.push(root);
    await writeFile(path.join(root, "README.md"), "fixture\n");
    let stdout = "";
    let stderr = "";

    const exitCode = await runCli(["scan", root, "--format", "json"], {
      stdout: (value) => {
        stdout += value;
      },
      stderr: (value) => {
        stderr += value;
      },
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toMatchObject({
      schemaVersion: "1",
      repository: { name: path.basename(root) },
      profile: { fileCount: 1 },
    });
  });

  it("rejects unsupported output formats", async () => {
    let stderr = "";

    const exitCode = await runCli(["scan", ".", "--format", "xml"], {
      stdout: () => undefined,
      stderr: (value) => {
        stderr += value;
      },
    });

    expect(exitCode).toBe(EXIT_CODES.INVALID_USAGE);
    expect(stderr).toContain("format must be terminal or json");
  });

  it("reports that score gates are unavailable before rules exist", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentcheck-gate-"));
    temporaryDirectories.push(root);
    let stderr = "";

    const exitCode = await runCli(["scan", root, "--min-score", "70"], {
      stdout: () => undefined,
      stderr: (value) => {
        stderr += value;
      },
    });

    expect(exitCode).toBe(EXIT_CODES.INCOMPLETE_ANALYSIS);
    expect(stderr).toContain("cannot apply --min-score");
  });
});
