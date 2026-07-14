import { Command, CommanderError, InvalidArgumentError } from "commander";

import packageJson from "../../package.json" with { type: "json" };
import { scanRepository } from "../application/scan-repository.js";
import { loadAgentCheckConfig } from "../config/agentcheck-config.js";
import { AgentCheckError, ConfigError } from "../domain/errors.js";
import type { Severity } from "../domain/types.js";
import { renderJson } from "../reporters/json-reporter.js";
import { renderTerminal } from "../reporters/terminal-reporter.js";
import { ALL_RULES } from "../rules/evaluate-rules.js";
import { EXIT_CODES } from "./exit-codes.js";

interface CliIo {
  stdout: (value: string) => void;
  stderr: (value: string) => void;
}

interface ScanCommandOptions {
  format: string;
  ci: boolean;
  minScore?: number;
  failOn?: Exclude<Severity, "info">;
  failOnIncomplete?: boolean;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
};

function parseScore(value: string): number {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new InvalidArgumentError("score must be a number between 0 and 100");
  }

  return score;
}

function parseSeverity(value: string): Exclude<Severity, "info"> {
  if (value !== "critical" && value !== "high" && value !== "medium" && value !== "low") {
    throw new InvalidArgumentError("severity must be critical, high, medium, or low");
  }
  return value;
}

function writeLine(writer: (value: string) => void, value: string): void {
  writer(value.endsWith("\n") ? value : `${value}\n`);
}

export async function runCli(
  argv: string[],
  io: CliIo = {
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  },
): Promise<number> {
  let exitCode: number = EXIT_CODES.SUCCESS;
  const program = new Command();

  program
    .name("agentcheck")
    .description("Evidence-first repository readiness checks for AI coding agents.")
    .version(packageJson.version)
    .showHelpAfterError()
    .exitOverride()
    .configureOutput({
      writeOut: io.stdout,
      writeErr: io.stderr,
    });

  program
    .command("scan")
    .description("Analyze a repository without executing its code")
    .argument("[path]", "repository path", ".")
    .option("--format <format>", "terminal or json", "terminal")
    .option("--ci", "enable CI gate behavior", false)
    .option("--min-score <score>", "minimum accepted overall score", parseScore)
    .option("--fail-on <severity>", "fail when a finding reaches this severity", parseSeverity)
    .option("--fail-on-incomplete", "fail when the analysis is incomplete")
    .action(async (targetPath: string, options: ScanCommandOptions) => {
      if (options.format !== "terminal" && options.format !== "json") {
        throw new InvalidArgumentError("format must be terminal or json");
      }

      const config = await loadAgentCheckConfig(targetPath);
      const result = await scanRepository(targetPath, {
        toolVersion: packageJson.version,
        config,
      });

      io.stdout(options.format === "json" ? renderJson(result) : renderTerminal(result));

      const failOnIncomplete = options.failOnIncomplete ?? config.gates.failOnIncomplete ?? false;
      if (!result.complete && failOnIncomplete) {
        exitCode = EXIT_CODES.INCOMPLETE_ANALYSIS;
        return;
      }

      const minScore = options.minScore ?? config.gates.minScore;
      if (minScore !== undefined) {
        if (result.scores.overall === null) {
          writeLine(
            io.stderr,
            "AgentCheck cannot apply --min-score before readiness rules are installed.",
          );
          exitCode = EXIT_CODES.INCOMPLETE_ANALYSIS;
          return;
        }

        if (result.scores.overall < minScore) {
          exitCode = EXIT_CODES.POLICY_GATE_FAILED;
        }
      }

      const failOn = options.failOn ?? config.gates.failOn;
      if (failOn !== undefined && result.findings.some((finding) =>
        (finding.status === "fail" || finding.status === "error")
        && SEVERITY_ORDER[finding.severity] >= SEVERITY_ORDER[failOn])) {
        exitCode = EXIT_CODES.SEVERITY_GATE_FAILED;
      }
    });

  program
    .command("rules")
    .description("List the installed deterministic rules")
    .action(() => {
      const lines = ALL_RULES.map((rule) =>
        `${rule.id}\t${rule.severity}\t${rule.category}\t${rule.title}`,
      );
      writeLine(io.stdout, ["RULE\tSEVERITY\tCATEGORY\tTITLE", ...lines].join("\n"));
    });

  program
    .command("explain")
    .description("Explain one installed rule")
    .argument("<rule-id>", "rule identifier, for example AC-CTX-001")
    .action((ruleId: string) => {
      const rule = ALL_RULES.find((candidate) => candidate.id === ruleId.toUpperCase());
      if (rule === undefined) throw new InvalidArgumentError(`unknown rule: ${ruleId}`);
      const lines = [
        `${rule.id}: ${rule.title}`,
        `Category: ${rule.category}`,
        `Severity: ${rule.severity}`,
        `Points: ${rule.maxPoints}`,
        `Check: ${rule.description ?? "Deterministic repository evidence check."}`,
        `Remediation: ${rule.remediation ?? "Address the evidence reported by agentcheck scan."}`,
      ];
      writeLine(io.stdout, lines.join("\n"));
    });

  try {
    if (argv.length === 0) {
      program.help();
    }

    await program.parseAsync(argv, { from: "user" });
  } catch (error) {
    if (error instanceof InvalidArgumentError) {
      writeLine(io.stderr, `Error: ${error.message}`);
      return EXIT_CODES.INVALID_USAGE;
    }

    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? EXIT_CODES.SUCCESS : EXIT_CODES.INVALID_USAGE;
    }

    if (error instanceof ConfigError) {
      writeLine(io.stderr, `Error: ${error.message}`);
      return EXIT_CODES.INVALID_USAGE;
    }

    if (error instanceof AgentCheckError) {
      writeLine(io.stderr, `Error: ${error.message}`);
      return EXIT_CODES.INCOMPLETE_ANALYSIS;
    }

    const message = error instanceof Error ? error.message : String(error);
    writeLine(io.stderr, `AgentCheck failed: ${message}`);
    return EXIT_CODES.INTERNAL_ERROR;
  }

  return exitCode;
}
