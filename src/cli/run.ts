import { Command, CommanderError, InvalidArgumentError } from "commander";

import packageJson from "../../package.json" with { type: "json" };
import { scanRepository } from "../application/scan-repository.js";
import { AgentCheckError } from "../domain/errors.js";
import { renderJson } from "../reporters/json-reporter.js";
import { renderTerminal } from "../reporters/terminal-reporter.js";
import { EXIT_CODES } from "./exit-codes.js";

interface CliIo {
  stdout: (value: string) => void;
  stderr: (value: string) => void;
}

interface ScanCommandOptions {
  format: string;
  ci: boolean;
  minScore?: number;
}

function parseScore(value: string): number {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new InvalidArgumentError("score must be a number between 0 and 100");
  }

  return score;
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
    .action(async (targetPath: string, options: ScanCommandOptions) => {
      if (options.format !== "terminal" && options.format !== "json") {
        throw new InvalidArgumentError("format must be terminal or json");
      }

      const result = await scanRepository(targetPath, {
        toolVersion: packageJson.version,
      });

      io.stdout(options.format === "json" ? renderJson(result) : renderTerminal(result));

      if (!result.complete) {
        exitCode = EXIT_CODES.INCOMPLETE_ANALYSIS;
        return;
      }

      if (options.minScore !== undefined) {
        if (result.scores.overall === null) {
          writeLine(
            io.stderr,
            "AgentCheck cannot apply --min-score before readiness rules are installed.",
          );
          exitCode = EXIT_CODES.INCOMPLETE_ANALYSIS;
          return;
        }

        if (result.scores.overall < options.minScore) {
          exitCode = EXIT_CODES.POLICY_GATE_FAILED;
        }
      }
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
