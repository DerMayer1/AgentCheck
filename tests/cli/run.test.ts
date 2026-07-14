import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../../src/cli/run.js";
import { EXIT_CODES } from "../../src/cli/exit-codes.js";

const temporaryDirectories: string[] = [];
const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
);

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

  it("fails a score gate for an unprepared repository", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentcheck-gate-"));
    temporaryDirectories.push(root);
    let stderr = "";

    const exitCode = await runCli(["scan", root, "--min-score", "70"], {
      stdout: () => undefined,
      stderr: (value) => {
        stderr += value;
      },
    });

    expect(exitCode).toBe(EXIT_CODES.POLICY_GATE_FAILED);
    expect(stderr).toBe("");
  });

  it("passes and fails score gates from real findings", async () => {
    const passingCode = await runCli(
      ["scan", path.join(fixtureRoot, "coherent"), "--ci", "--min-score", "100"],
      { stdout: () => undefined, stderr: () => undefined },
    );
    const failingCode = await runCli(
      ["scan", path.join(fixtureRoot, "ci-divergence"), "--ci", "--min-score", "100"],
      { stdout: () => undefined, stderr: () => undefined },
    );

    expect(passingCode).toBe(EXIT_CODES.SUCCESS);
    expect(failingCode).toBe(EXIT_CODES.POLICY_GATE_FAILED);
  });

  it("lists and explains installed rules", async () => {
    let rules = "";
    let explanation = "";
    expect(await runCli(["rules"], { stdout: (value) => { rules += value; }, stderr: () => undefined })).toBe(0);
    expect(await runCli(["explain", "ac-ctx-001"], { stdout: (value) => { explanation += value; }, stderr: () => undefined })).toBe(0);
    expect(rules).toContain("AC-CTX-001");
    expect(rules.trim().split("\n")).toHaveLength(19);
    expect(explanation).toContain("Repository overview is actionable");
    expect(explanation).toContain("Remediation:");
  });

  it("uses a distinct exit code for severity gates", async () => {
    const code = await runCli(
      ["scan", path.join(fixtureRoot, "unsafe"), "--fail-on", "high"],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(EXIT_CODES.SEVERITY_GATE_FAILED);
  });

  it("rejects invalid repository configuration", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentcheck-invalid-config-"));
    temporaryDirectories.push(root);
    await writeFile(path.join(root, ".agentcheck.json"), '{"rules":{"AC-NOT-999":"off"}}');
    let stderr = "";
    const code = await runCli(["scan", root], { stdout: () => undefined, stderr: (value) => { stderr += value; } });
    expect(code).toBe(EXIT_CODES.INVALID_USAGE);
    expect(stderr).toContain("unknown rule");
  });
});
