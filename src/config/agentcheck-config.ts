import { readFile } from "node:fs/promises";
import path from "node:path";

import { ConfigError } from "../domain/errors.js";
import type { Severity } from "../domain/types.js";
import { DEFAULT_TRAVERSAL_LIMITS, type TraversalLimits } from "../repository/repository-reader.js";
import { ALL_RULES } from "../rules/evaluate-rules.js";

export type RuleLevel = "off" | "warn" | "error";

export interface AgentCheckGates {
  minScore?: number;
  failOn?: Exclude<Severity, "info">;
  failOnIncomplete?: boolean;
}

export interface AgentCheckConfig {
  ignore: string[];
  rules: Record<string, RuleLevel>;
  limits: TraversalLimits;
  gates: AgentCheckGates;
}

const CONFIG_FILE = ".agentcheck.json";
const RULE_IDS = new Set(ALL_RULES.map((rule) => rule.id));
const RULE_LEVELS = new Set(["off", "warn", "error"]);
const SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const LIMIT_KEYS = new Set<keyof TraversalLimits>([
  "maxDepth", "maxFiles", "maxFileBytes", "maxTotalBytes", "timeoutMs",
]);

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConfigError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: Set<string>, label: string): void {
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown !== undefined) throw new ConfigError(`${label} contains unknown key: ${unknown}.`);
}

function parseConfig(value: unknown): AgentCheckConfig {
  const root = objectValue(value, CONFIG_FILE);
  rejectUnknownKeys(root, new Set(["ignore", "rules", "limits", "gates"]), CONFIG_FILE);

  const ignoreValue = root.ignore ?? [];
  if (!Array.isArray(ignoreValue) || ignoreValue.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new ConfigError("ignore must be an array of non-empty glob strings.");
  }

  const ruleValues = objectValue(root.rules ?? {}, "rules");
  const rules: Record<string, RuleLevel> = {};
  for (const [ruleId, level] of Object.entries(ruleValues)) {
    if (!RULE_IDS.has(ruleId)) throw new ConfigError(`rules contains unknown rule: ${ruleId}.`);
    if (typeof level !== "string" || !RULE_LEVELS.has(level)) {
      throw new ConfigError(`rules.${ruleId} must be off, warn, or error.`);
    }
    rules[ruleId] = level as RuleLevel;
  }

  const limitValues = objectValue(root.limits ?? {}, "limits");
  rejectUnknownKeys(limitValues, LIMIT_KEYS, "limits");
  const limits: TraversalLimits = { ...DEFAULT_TRAVERSAL_LIMITS };
  for (const [key, limit] of Object.entries(limitValues)) {
    if (!Number.isInteger(limit) || (limit as number) <= 0) {
      throw new ConfigError(`limits.${key} must be a positive integer.`);
    }
    limits[key as keyof TraversalLimits] = limit as number;
  }

  const gateValues = objectValue(root.gates ?? {}, "gates");
  rejectUnknownKeys(gateValues, new Set(["minScore", "failOn", "failOnIncomplete"]), "gates");
  const gates: AgentCheckGates = {};
  if (gateValues.minScore !== undefined) {
    if (typeof gateValues.minScore !== "number" || gateValues.minScore < 0 || gateValues.minScore > 100) {
      throw new ConfigError("gates.minScore must be a number between 0 and 100.");
    }
    gates.minScore = gateValues.minScore;
  }
  if (gateValues.failOn !== undefined) {
    if (typeof gateValues.failOn !== "string" || !SEVERITIES.has(gateValues.failOn)) {
      throw new ConfigError("gates.failOn must be critical, high, medium, or low.");
    }
    gates.failOn = gateValues.failOn as Exclude<Severity, "info">;
  }
  if (gateValues.failOnIncomplete !== undefined) {
    if (typeof gateValues.failOnIncomplete !== "boolean") {
      throw new ConfigError("gates.failOnIncomplete must be a boolean.");
    }
    gates.failOnIncomplete = gateValues.failOnIncomplete;
  }

  return { ignore: [...ignoreValue] as string[], rules, limits, gates };
}

export async function loadAgentCheckConfig(targetPath: string): Promise<AgentCheckConfig> {
  const root = path.resolve(targetPath);
  const configPath = path.join(root, CONFIG_FILE);
  let source: string;
  try {
    source = await readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return parseConfig({});
    throw new ConfigError(`Cannot read ${CONFIG_FILE}: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    return parseConfig(JSON.parse(source) as unknown);
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError(`${CONFIG_FILE} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
