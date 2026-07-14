import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { scanRepository } from "../../src/application/scan-repository.js";
import { loadAgentCheckConfig } from "../../src/config/agentcheck-config.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe(".agentcheck.json", () => {
  it("applies ignore patterns, limits, gates, and rule levels", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentcheck-config-"));
    temporaryDirectories.push(root);
    await writeFile(path.join(root, "package.json"), "{}\n");
    await writeFile(path.join(root, "ignored.log"), "large generated output\n");
    await writeFile(path.join(root, ".agentcheck.json"), JSON.stringify({
      ignore: ["*.log"],
      rules: { "AC-CTX-001": "off", "AC-CTX-002": "warn" },
      limits: { maxFiles: 100 },
      gates: { minScore: 75, failOn: "high", failOnIncomplete: true },
    }));

    const config = await loadAgentCheckConfig(root);
    const result = await scanRepository(root, { toolVersion: "test", config });

    expect(config.gates).toEqual({ minScore: 75, failOn: "high", failOnIncomplete: true });
    expect(result.profile.fileCount).toBe(2);
    expect(result.findings.find((finding) => finding.ruleId === "AC-CTX-001")?.status).toBe("skip");
    expect(result.findings.find((finding) => finding.ruleId === "AC-CTX-002")?.status).toBe("warn");
  });

  it("rejects oversized configuration before parsing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentcheck-large-config-"));
    temporaryDirectories.push(root);
    await writeFile(path.join(root, ".agentcheck.json"), " ".repeat(262_145));

    await expect(loadAgentCheckConfig(root)).rejects.toMatchObject({ code: "CONFIG_ERROR" });
  });
});
