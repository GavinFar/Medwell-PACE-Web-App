import { describe, it, expect, vi } from "vitest";

// Replace the real Supabase connection with a mock.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

// Replace the server-only marker for the test environment.
vi.mock("server-only", () => ({}));

import { createAdminClient } from "@/lib/supabase/admin";
import { getScoringRule } from "./rules";

describe("PACE Scoring Rules", () => {
  it("retrieves an active scoring rule", async () => {
    const fakeRule = {
      id: "rule-1",
      activity_type: "event_attendance",
      category: null,
      points: 10,
      calculation_type: "fixed",
    };

    const maybeSingle = vi.fn().mockResolvedValue({
      data: fakeRule,
      error: null,
    });

    const eq = vi.fn();
    eq.mockReturnValue({ eq, maybeSingle });

    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(createAdminClient).mockReturnValue(
      { from } as unknown as ReturnType<typeof createAdminClient>
    );

    const result = await getScoringRule("event_attendance");

    expect(result).toEqual(fakeRule);
    expect(from).toHaveBeenCalledWith("pace_scoring_rules");
    expect(eq).toHaveBeenCalledWith(
      "activity_type",
      "event_attendance"
    );
    expect(eq).toHaveBeenCalledWith("is_active", true);
  });

  it("returns null when no active rule exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const eq = vi.fn();
    eq.mockReturnValue({ eq, maybeSingle });

    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(createAdminClient).mockReturnValue(
      { from } as unknown as ReturnType<typeof createAdminClient>
    );

    const result = await getScoringRule("unknown_activity");

    expect(result).toBeNull();
  });
});
