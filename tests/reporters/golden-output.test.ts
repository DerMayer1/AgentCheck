import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/application/scan-repository.js";
import { renderJson } from "../../src/reporters/json-reporter.js";
import { renderTerminal } from "../../src/reporters/terminal-reporter.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(testDirectory, "../fixtures/coherent");
const goldenDirectory = path.resolve(testDirectory, "../golden");

describe("golden output contracts", () => {
  it("keeps terminal and JSON output stable", async () => {
    const result = await scanRepository(fixture, { toolVersion: "0.0.0" });
    const terminal = renderTerminal(result)
      .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
      .split(result.repository.root).join("<ROOT>")
      .replace(/Completed in \d+ms/, "Completed in <DURATION>");
    const parsed = JSON.parse(renderJson(result)) as typeof result;
    const jsonContract = {
      schemaVersion: parsed.schemaVersion,
      toolVersion: parsed.toolVersion,
      complete: parsed.complete,
      repository: parsed.repository.name,
      fileCount: parsed.profile.fileCount,
      overall: parsed.scores.overall,
      findings: parsed.findings.map((finding) => `${finding.ruleId}:${finding.status}`),
    };

    expect(terminal).toBe(await readFile(path.join(goldenDirectory, "coherent.terminal.txt"), "utf8"));
    expect(`${JSON.stringify(jsonContract, null, 2)}\n`).toBe(
      await readFile(path.join(goldenDirectory, "coherent.json"), "utf8"),
    );
  });
});
