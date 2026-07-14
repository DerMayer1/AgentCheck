import type { RepositoryFacts } from "../domain/facts.js";
import type { Finding } from "../domain/types.js";
import { INITIAL_RULES } from "./initial-rules.js";

export function evaluateRules(facts: RepositoryFacts): Finding[] {
  return INITIAL_RULES.map((rule) => rule.evaluate(facts));
}
