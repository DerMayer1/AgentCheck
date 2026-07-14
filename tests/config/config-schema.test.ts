import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020Module from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const Ajv2020 = Ajv2020Module as unknown as new (options: { allErrors: boolean }) => {
  compile: (schema: object) => ((data: unknown) => boolean) & { errors?: unknown };
};

describe("configuration JSON schema", () => {
  it("accepts the documented v1 configuration and rejects unknown fields", async () => {
    const schema = JSON.parse(await readFile(path.join(root, "schemas/config-v1.schema.json"), "utf8")) as object;
    const validate = new Ajv2020({ allErrors: true }).compile(schema);
    const valid = {
      ignore: ["generated/**"],
      rules: { "AC-CTX-002": "warn" },
      limits: { maxFiles: 25_000 },
      gates: { minScore: 80, failOn: "high", failOnIncomplete: true },
    };

    expect(validate(valid), JSON.stringify(validate.errors, null, 2)).toBe(true);
    expect(validate({ ...valid, network: true })).toBe(false);
  });
});
