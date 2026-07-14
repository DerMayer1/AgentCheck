import pc from "picocolors";

import type { ScanResult } from "../domain/types.js";

function formatBytes(bytes: number): string {
  if (bytes < 1_024) {
    return `${bytes} B`;
  }

  if (bytes < 1_048_576) {
    return `${(bytes / 1_024).toFixed(1)} KiB`;
  }

  return `${(bytes / 1_048_576).toFixed(1)} MiB`;
}

export function renderTerminal(result: ScanResult): string {
  const lines = [
    pc.bold(`AgentCheck ${result.toolVersion}`),
    "",
    `${pc.dim("Repository")}  ${result.repository.name}`,
    `${pc.dim("Root")}        ${result.repository.root}`,
    `${pc.dim("Files")}       ${result.profile.fileCount}`,
    `${pc.dim("Size")}        ${formatBytes(result.profile.totalBytes)}`,
    `${pc.dim("Git")}         ${result.repository.gitRepository ? "detected" : "not detected"}`,
    "",
    pc.yellow("No readiness rules are installed in the Phase 1 walking skeleton."),
  ];

  if (result.limitations.length > 0) {
    lines.push("", pc.bold("Limitations"));
    for (const limitation of result.limitations) {
      const location = limitation.path === undefined ? "" : ` (${limitation.path})`;
      lines.push(`- ${limitation.code}${location}: ${limitation.message}`);
    }
  }

  lines.push("", pc.dim(`Completed in ${result.durationMs}ms`), "");
  return lines.join("\n");
}
