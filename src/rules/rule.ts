import type { RepositoryFacts } from "../domain/facts.js";
import type { Category, Finding, Severity } from "../domain/types.js";

export interface RuleDefinition {
  id: string;
  category: Category;
  title: string;
  severity: Severity;
  maxPoints: number;
  evaluate: (facts: RepositoryFacts) => Finding;
}

export function skippedFinding(rule: Omit<RuleDefinition, "evaluate">, impact: string): Finding {
  return {
    ruleId: rule.id,
    category: rule.category,
    status: "skip",
    severity: "info",
    confidence: "high",
    title: rule.title,
    impact,
    evidence: [],
    earnedPoints: 0,
    maxPoints: rule.maxPoints,
  };
}
