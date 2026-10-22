export interface ScoringRule {
  points: number;
  type: "fixed" | "per_unit";
}

export function calculatePacePoints(
  rule: ScoringRule,
  quantity: number = 1
): number {
  if (!Number.isSafeInteger(rule.points) || rule.points < 0) {
    throw new Error("Points must be a non-negative integer");
  }

  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error("Quantity must be a non-negative integer");
  }

  const total =
    rule.type === "fixed"
      ? rule.points
      : rule.points * quantity;

  if (!Number.isSafeInteger(total) || total > 2147483647) {
    throw new Error("Calculated points exceed the allowed limit");
  }

  return total;
}