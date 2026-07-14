import pc from "picocolors";

import type { ScanResult } from "../domain/types.js";

const CATEGORY_LABELS = {
  verification: "Verification",
  environment: "Environment",
  safety: "Safety",
  context: "Context",
  integrity: "Integrity",
} as const;

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
  const failedFindings = result.findings.filter(
    (finding) => finding.status === "fail" || finding.status === "warn",
  );
  const passedCount = result.findings.filter((finding) => finding.status === "pass").length;
  const lines = [
    pc.bold(`AgentCheck ${result.toolVersion}`),
    "",
    `${pc.dim("Repository")}  ${result.repository.name}`,
    `${pc.dim("Root")}        ${result.repository.root}`,
    `${pc.dim("Files")}       ${result.profile.fileCount}`,
    `${pc.dim("Size")}        ${formatBytes(result.profile.totalBytes)}`,
    `${pc.dim("Git")}         ${result.repository.gitRepository ? "detected" : "not detected"}`,
  ];

  if (result.scores.overall === null) {
    lines.push("", pc.yellow("No applicable readiness rules were scored."));
  } else {
    lines.push("", pc.bold(`AGENT READINESS  ${result.scores.overall}/100`));
    for (const category of result.scores.categories) {
      if (category.score !== null) {
        lines.push(
          `${CATEGORY_LABELS[category.category].padEnd(14)} ${String(category.score).padStart(3)}/100`,
        );
      }
    }
    lines.push(
      "",
      `${pc.green(`${passedCount} passed`)} · ${
        failedFindings.length === 0
          ? pc.green("0 findings")
          : pc.yellow(`${failedFindings.length} findings`)
      }`,
    );
  }

  if (failedFindings.length > 0) {
    lines.push("", pc.bold("Findings"));
    for (const finding of failedFindings) {
      const marker = finding.status === "fail" ? pc.red("x") : pc.yellow("!");
      lines.push(`${marker} ${finding.ruleId}  ${finding.title}`);
      const firstEvidence = finding.evidence[0];
      if (firstEvidence !== undefined) {
        const location = firstEvidence.path === undefined
          ? ""
          : `${firstEvidence.path}${firstEvidence.line === undefined ? "" : `:${firstEvidence.line}`}: `;
        lines.push(`  ${pc.dim(location)}${firstEvidence.message}`);
      }
      if (finding.recommendation !== undefined) {
        lines.push(`  ${pc.dim("Fix:")} ${finding.recommendation}`);
      }
    }
  }

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
