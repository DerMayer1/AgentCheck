import type { Category, CategoryScore, ScoreSummary } from "../domain/types.js";

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
