import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/application/scan-repository.js";

const fixtures = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
);

function finding(result: Awaited<ReturnType<typeof scanRepository>>, ruleId: string) {
  const value = result.findings.find((candidate) => candidate.ruleId === ruleId);
  expect(value, `${ruleId} should be evaluated`).toBeDefined();
  return value;
}

describe("repository evidence rules", () => {
  it("scores a coherent repository from manifest, documentation, and CI evidence", async () => {
    const result = await scanRepository(path.join(fixtures, "coherent"), {
      toolVersion: "test",
    });

    expect(result.complete).toBe(true);
    expect(result.profile).toMatchObject({
      ecosystems: ["node", "typescript"],
      packageManagers: ["npm"],
      workspace: false,
    });
    expect(result.scores.overall).toBe(100);
    expect(result.findings).toHaveLength(18);
    expect(result.findings.every((item) => item.status === "pass" || item.status === "skip")).toBe(true);
    expect(finding(result, "AC-VER-004")?.evidence[0]).toMatchObject({
      path: ".github/workflows/ci.yml",
      line: 8,
    });
    expect(finding(result, "AC-CTX-002")?.status).toBe("pass");
    expect(finding(result, "AC-ENV-002")?.status).toBe("pass");
  });

  it("finds a documented script that is missing from package.json", async () => {
    const result = await scanRepository(path.join(fixtures, "docs-divergence"), {
      toolVersion: "test",
    });

    expect(finding(result, "AC-INT-001")).toMatchObject({
      status: "fail",
      confidence: "high",
      evidence: [
        expect.objectContaining({
          path: "README.md",
          line: 3,
        }),
      ],
    });
    expect(result.scores.overall).toBeLessThan(100);
  });

  it("finds CI that does not invoke the canonical verification command", async () => {
    const result = await scanRepository(path.join(fixtures, "ci-divergence"), {
      toolVersion: "test",
    });

    expect(finding(result, "AC-VER-004")).toMatchObject({
      status: "fail",
      evidence: [
        expect.objectContaining({
          path: ".github/workflows/ci.yml",
          line: 7,
        }),
      ],
    });
  });

  it("finds contradictory package-manager evidence", async () => {
    const result = await scanRepository(path.join(fixtures, "manager-divergence"), {
      toolVersion: "test",
    });

    expect(finding(result, "AC-ENV-003")).toMatchObject({
      status: "fail",
      confidence: "high",
    });
    expect(result.profile.packageManagers).toEqual(["npm", "pnpm"]);
  });

  it("recognizes an explicitly declared workspace", async () => {
    const result = await scanRepository(path.join(fixtures, "workspace"), {
      toolVersion: "test",
    });

    expect(result.profile.workspace).toBe(true);
  });
});
