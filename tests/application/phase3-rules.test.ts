import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/application/scan-repository.js";

const unsafeFixture = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/unsafe",
);

describe("Phase 3 rules", () => {
  it("evaluates the complete 18-rule catalog", async () => {
    const result = await scanRepository(unsafeFixture, { toolVersion: "test" });
    const failed = new Set(result.findings.filter((finding) => finding.status === "fail").map((finding) => finding.ruleId));

    expect(result.findings).toHaveLength(18);
    expect([...failed]).toEqual(expect.arrayContaining([
      "AC-VER-006",
      "AC-ENV-002",
      "AC-ENV-004",
      "AC-SAFE-001",
      "AC-SAFE-002",
      "AC-SAFE-004",
      "AC-INT-002",
    ]));
  });
});
