import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const packed = spawnSync(npmCommand, ["pack", "--json"], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
if (packed.status !== 0) throw new Error(packed.stderr || "npm pack failed");
const manifest = JSON.parse(packed.stdout)[0];
const tarball = path.join(root, manifest.filename);
const sandbox = await mkdtemp(path.join(tmpdir(), "agentcheck-package-"));

try {
  const allowedRoots = new Set(["LICENSE", "README.md", "assets", "dist", "package.json", "schemas"]);
  const unexpected = manifest.files.map((file) => file.path.split("/")[0]).filter((entry) => !allowedRoots.has(entry));
  if (unexpected.length > 0) throw new Error(`Unexpected tarball entries: ${[...new Set(unexpected)].join(", ")}`);
  for (const required of [
    "assets/readme/hero.png",
    "assets/readme/scan-pass.png",
    "assets/readme/scan-findings.png",
    "dist/cli/main.js",
    "schemas/config-v1.schema.json",
    "schemas/scan-result-v1.schema.json",
  ]) {
    if (!manifest.files.some((file) => file.path === required)) throw new Error(`Tarball is missing ${required}`);
  }

  await writeFile(path.join(sandbox, "package.json"), '{"private":true}\n');
  const installed = spawnSync(npmCommand, ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
    cwd: sandbox, encoding: "utf8", shell: process.platform === "win32",
  });
  if (installed.status !== 0) throw new Error(installed.stderr || "tarball installation failed");
  const executable = path.join(sandbox, "node_modules", ".bin", process.platform === "win32" ? "agentcheck.cmd" : "agentcheck");
  await access(executable);
  const scanned = spawnSync(executable, ["scan", root, "--format", "json"], {
    cwd: sandbox, encoding: "utf8", shell: process.platform === "win32",
  });
  if (scanned.status !== 0) throw new Error(scanned.stderr || "packaged CLI scan failed");
  const result = JSON.parse(scanned.stdout);
  const installedPackage = JSON.parse(await readFile(path.join(sandbox, "node_modules", "agentcheck", "package.json"), "utf8"));
  if (result.toolVersion !== installedPackage.version || result.schemaVersion !== "1") throw new Error("Packaged CLI contract mismatch");
  console.log(JSON.stringify({ version: installedPackage.version, files: manifest.files.length, packedBytes: manifest.size, scanScore: result.scores.overall }));
} finally {
  await rm(sandbox, { recursive: true, force: true });
  await rm(tarball, { force: true });
}
