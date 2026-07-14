import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { scanRepository } from "../dist/application/scan-repository.js";

const FILE_COUNT = 2_500;
const TARGET_MS = 5_000;
const root = await mkdtemp(path.join(tmpdir(), "agentcheck-benchmark-"));

try {
  const source = path.join(root, "src");
  await mkdir(source);
  await Promise.all(Array.from({ length: FILE_COUNT }, (_, index) =>
    writeFile(path.join(source, `module-${String(index).padStart(4, "0")}.ts`), `export const value${index} = ${index};\n`),
  ));
  await writeFile(path.join(root, "package.json"), JSON.stringify({
    private: true,
    packageManager: "npm@10.9.4",
    engines: { node: ">=22.12" },
    scripts: { typecheck: "tsc --noEmit" },
  }));

  const startedAt = performance.now();
  const result = await scanRepository(root, { toolVersion: "benchmark" });
  const elapsedMs = Math.round(performance.now() - startedAt);
  const measurement = { files: result.profile.fileCount, bytes: result.profile.totalBytes, elapsedMs, targetMs: TARGET_MS };
  console.log(JSON.stringify(measurement));
  if (!result.complete || result.profile.fileCount !== FILE_COUNT + 1 || elapsedMs > TARGET_MS) process.exitCode = 1;
} finally {
  await rm(root, { recursive: true, force: true });
}
