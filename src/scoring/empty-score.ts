import type { Category, CategoryScore, Finding, ScoreSummary } from "../domain/types.js";

const CATEGORY_WEIGHTS: ReadonlyArray<readonly [Category, number]> = [
  ["verification", 0.3],
  ["environment", 0.25],
  ["safety", 0.2],
  ["context", 0.15],
  ["integrity", 0.1],
];

export function createEmptyScore(): ScoreSummary {
  const categories: CategoryScore[] = CATEGORY_WEIGHTS.map(
    ([category, weight]) => ({
      category,
      weight,
      score: null,
      earnedPoints: 0,
      maxPoints: 0,
    }),
  );

  return {
    overall: null,
    categories,
  };
}

export function calculateScore(findings: readonly Finding[]): ScoreSummary {
  const categories: CategoryScore[] = CATEGORY_WEIGHTS.map(([category, weight]) => {
    const applicable = findings.filter(
      (finding) =>
        finding.category === category &&
        finding.status !== "skip" &&
        finding.status !== "error" &&
        finding.confidence !== "low",
    );
    const earnedPoints = applicable.reduce((total, finding) => total + finding.earnedPoints, 0);
    const maxPoints = applicable.reduce((total, finding) => total + finding.maxPoints, 0);
    return {
      category,
      weight,
      score: maxPoints === 0 ? null : Math.round((earnedPoints / maxPoints) * 100),
      earnedPoints,
      maxPoints,
    };
  });

  const scoredCategories = categories.filter(
    (category): category is CategoryScore & { score: number } => category.score !== null,
  );
  const applicableWeight = scoredCategories.reduce((total, category) => total + category.weight, 0);
  const overall =
    applicableWeight === 0
      ? null
      : Math.round(
          scoredCategories.reduce(
            (total, category) => total + category.score * category.weight,
            0,
          ) / applicableWeight,
        );

  return { overall, categories };
}
