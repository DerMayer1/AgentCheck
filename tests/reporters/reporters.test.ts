import { describe, expect, it } from "vitest";

import type { ScanResult } from "../../src/domain/types.js";
import { renderJson } from "../../src/reporters/json-reporter.js";
import { renderTerminal } from "../../src/reporters/terminal-reporter.js";
import { createEmptyScore } from "../../src/scoring/empty-score.js";

const result: ScanResult = {
  schemaVersion: "1",
  toolVersion: "0.0.0",
  complete: true,
  repository: {
    name: "fixture",
    root: "/tmp/fixture",
    gitRepository: true,
  },
  profile: {
    ecosystems: [],
    fileCount: 2,
    totalBytes: 1_500,
  },
  findings: [],
  scores: createEmptyScore(),
  limitations: [],
  durationMs: 8,
};

describe("reporters", () => {
  it("emits parseable versioned JSON", () => {
    const rendered = renderJson(result);
    expect(JSON.parse(rendered)).toMatchObject({
      schemaVersion: "1",
      repository: { name: "fixture" },
    });
    expect(rendered.endsWith("\n")).toBe(true);
  });

  it("emits a useful terminal summary", () => {
    const rendered = renderTerminal(result);
    expect(rendered).toContain("AgentCheck 0.0.0");
    expect(rendered).toContain("fixture");
    expect(rendered).toContain("2");
    expect(rendered).toContain("No readiness rules are installed");
  });
});
