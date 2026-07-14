import type { CommandFact, CommandSource, PackageManager } from "../domain/facts.js";

const COMMAND_PATTERN = /\b(npm|npx|pnpm|yarn|bun)\s+([^\s`'";&|]+)/i;

function normalizeManager(value: string): PackageManager {
  return value.toLowerCase() === "npx"
    ? "npm"
    : (value.toLowerCase() as PackageManager);
}

function extractScript(managerToken: string, commandTail: string): string | undefined {
  const manager = managerToken.toLowerCase();
  const tokens = commandTail.trim().split(/\s+/);
  const sanitize = (value: string | undefined): string | undefined =>
    value?.replace(/^[`'"]+|[`'"),.;:]+$/g, "");
  const first = sanitize(tokens[0]);
  const second = sanitize(tokens[1]);

  if (manager === "npx" || first === undefined) {
    return undefined;
  }

  if (first === "run" || first === "run-script") {
    return second;
  }

  if (["install", "ci", "exec", "dlx", "add", "remove", "publish", "pack"].includes(first)) {
    return undefined;
  }

  if (manager === "npm") {
    return first === "test" || first === "start" || first === "stop" || first === "restart"
      ? first
      : undefined;
  }

  return first;
}

export function parseCommand(
  raw: string,
  source: CommandSource,
  path: string,
  line: number,
): CommandFact | undefined {
  const match = COMMAND_PATTERN.exec(raw);
  if (match === null) {
    return undefined;
  }
  const managerToken = match[1];
  const commandTail = match[2];
  if (managerToken === undefined || commandTail === undefined) {
    return undefined;
  }

  const script = extractScript(managerToken, `${commandTail} ${raw.slice(match.index + match[0].length)}`);

  return {
    source,
    path,
    line,
    raw: raw.trim(),
    packageManager: normalizeManager(managerToken),
    ...(script === undefined ? {} : { script }),
  };
}
