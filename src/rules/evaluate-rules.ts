import type { RepositoryFacts } from "../domain/facts.js";
import type { Finding } from "../domain/types.js";
import { INITIAL_RULES } from "./initial-rules.js";
import { PHASE3_RULES } from "./phase3-rules.js";
import type { RuleLevel } from "../config/agentcheck-config.js";

export const ALL_RULES = [...INITIAL_RULES, ...PHASE3_RULES] as const;

export function evaluateRules(
  facts: RepositoryFacts,
  overrides: Readonly<Record<string, RuleLevel>> = {},
): Finding[] {
  return ALL_RULES.map((rule) => {
    const level = overrides[rule.id];
    if (level === "off") {
      return {
        ...rule.evaluate(facts),
        status: "skip" as const,
        confidence: "high" as const,
        impact: "Rule disabled by .agentcheck.json.",
        evidence: [],
        earnedPoints: 0,
      };
    }
    const finding = rule.evaluate(facts);
    return level === "warn" && finding.status === "fail"
      ? { ...finding, status: "warn" as const }
      : finding;
  });
}
