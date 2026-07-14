import { fixture } from "./index.js";
import { expect, it } from "vitest";

it("provides discoverable test evidence", () => {
  expect(fixture).toBe(true);
});
