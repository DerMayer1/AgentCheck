import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import AjvModule from "ajv";
import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/application/scan-repository.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const Ajv = AjvModule as unknown as new (options: { allErrors: boolean }) => {
  compile: (schema: object) => ((data: unknown) => boolean) & { errors?: unknown };
};

describe("scan result JSON schema", () => {
  it("validates a real scan against the shipped v1 schema", async () => {
    const schema = JSON.parse(
      await readFile(path.join(root, "schemas/scan-result-v1.schema.json"), "utf8"),
    ) as object;
    const result = await scanRepository(path.join(root, "tests/fixtures/coherent"), {
      toolVersion: "test",
    });
    const validate = new Ajv({ allErrors: true }).compile(schema);

    expect(validate(result), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("continues to accept the frozen v1 consumer contract", async () => {
    const schema = JSON.parse(
      await readFile(path.join(root, "schemas/scan-result-v1.schema.json"), "utf8"),
    ) as { $id: string; required: string[] };
    const frozen = JSON.parse(
      await readFile(path.join(root, "tests/fixtures/contracts/scan-result-v1.json"), "utf8"),
    ) as unknown;
    const validate = new Ajv({ allErrors: true }).compile(schema);

    expect(schema.$id).toBe("https://agentcheck.dev/schema/scan-result-v1.json");
    expect(schema.required).toEqual([
      "schemaVersion", "toolVersion", "complete", "repository", "profile",
      "findings", "scores", "limitations", "durationMs",
    ]);
    expect(validate(frozen), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });
});
