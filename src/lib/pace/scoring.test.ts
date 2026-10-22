import { describe, it, expect } from "vitest";
import { calculatePacePoints } from "./scoring";

describe("PACE Points Calculator", () => {
  it("calculates fixed points", () => {
    expect(
      calculatePacePoints({
        points: 10,
        type: "fixed",
      })
    ).toBe(10);
  });

  it("calculates points per unit", () => {
    expect(
      calculatePacePoints(
        {
          points: 10,
          type: "per_unit",
        },
        3
      )
    ).toBe(30);
  });

  it("rejects negative points", () => {
    expect(() =>
      calculatePacePoints({
        points: -5,
        type: "fixed",
      })
    ).toThrow();
  });

  it("rejects decimal quantities", () => {
    expect(() =>
      calculatePacePoints(
        {
          points: 10,
          type: "per_unit",
        },
        2.5
      )
    ).toThrow();
  });

  it("rejects totals that exceed safe integer limits", () => {
    expect(() =>
      calculatePacePoints(
        {
          points: Number.MAX_SAFE_INTEGER,
          type: "per_unit",
        },
        2
      )
    ).toThrow();
  });
});
