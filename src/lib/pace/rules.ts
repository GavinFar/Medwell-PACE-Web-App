import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface PaceScoringRule {
  id: string;
  activity_type: string;
  category: string | null;
  points: number;
  calculation_type: "fixed" | "per_unit";
}

export async function getScoringRule(
  activityType: string
): Promise<PaceScoringRule | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("pace_scoring_rules")
    .select(
      "id, activity_type, category, points, calculation_type"
    )
    .eq("activity_type", activityType)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to retrieve scoring rule: ${error.message}`
    );
  }

  return data as PaceScoringRule | null;
}
