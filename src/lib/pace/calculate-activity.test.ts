import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("./rules", () => ({
  getScoringRule: vi.fn(),
}));

import { getScoringRule } from "./rules";
import { calculateActivityPoints } from "./calculate-activity";

describe("PACE Activity Points", () => {
  it("calculates fixed activity points", async () => {
    vi.mocked(getScoringRule).mockResolvedValue({
      id: "rule-1",
      activity_type: "event_attendance",
      category: null,
      points: 10,
      calculation_type: "fixed",
    });

    const result = await calculateActivityPoints(
      "event_attendance"
    );

    expect(result).toBe(10);
    expect(getScoringRule).toHaveBeenCalledWith(
      "event_attendance"
    );
  });

  it("calculates per-unit activity points", async () => {
    vi.mocked(getScoringRule).mockResolvedValue({
      id: "rule-2",
      activity_type: "volunteering",
      category: null,
      points: 10,
      calculation_type: "per_unit",
    });

    const result = await calculateActivityPoints(
      "volunteering",
      3
    );

    expect(result).toBe(30);
  });

  it("rejects activities without an active rule", async () => {
    vi.mocked(getScoringRule).mockResolvedValue(null);

    await expect(
      calculateActivityPoints("unknown_activity")
    ).rejects.toThrow(
      "No active scoring rule found for: unknown_activity"
    );
  });
});
