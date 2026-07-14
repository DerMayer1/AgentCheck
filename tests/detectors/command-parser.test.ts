import { describe, expect, it } from "vitest";

import { parseCommand } from "../../src/detectors/command-parser.js";

describe("parseCommand", () => {
  it("extracts npm scripts from inline Markdown without retaining punctuation", () => {
    expect(
      parseCommand("Run `npm run verify` before submitting.", "documentation", "README.md", 4),
    ).toMatchObject({
      packageManager: "npm",
      script: "verify",
      path: "README.md",
      line: 4,
    });
  });

  it("does not treat package installation as a script", () => {
    expect(parseCommand("npm install", "documentation", "README.md", 1)).toMatchObject({
      packageManager: "npm",
    });
    expect(parseCommand("npm install", "documentation", "README.md", 1)).not.toHaveProperty(
      "script",
    );
  });
});
