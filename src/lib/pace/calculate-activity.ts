import "server-only";

import { calculatePacePoints } from "./scoring";
import { getScoringRule } from "./rules";

export async function calculateActivityPoints(
  activityType: string,
  quantity: number = 1
): Promise<number> {
  // Look up the scoring rule in the database.
  const rule = await getScoringRule(activityType);

  // Stop if the activity has no active scoring rule.
  if (!rule) {
    throw new Error(
      `No active scoring rule found for: ${activityType}`
    );
  }

  // Calculate points using the retrieved rule.
  return calculatePacePoints(
    {
      points: rule.points,
      type: rule.calculation_type,
    },
    quantity
  );
}
