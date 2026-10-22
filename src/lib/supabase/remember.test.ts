import { describe, expect, it } from "vitest";
import { applyRemember } from "./remember";

describe("applyRemember", () => {
  const persistent = { path: "/", sameSite: "lax" as const, maxAge: 34_560_000 };

  it("keeps cookie lifetimes when the user chose Remember Me", () => {
    expect(applyRemember(persistent, true)).toEqual(persistent);
  });

  it("turns session cookies into browser-session cookies otherwise", () => {
    const result = applyRemember({ ...persistent, expires: new Date(2030, 0, 1) }, false);
    expect(result).toEqual({ path: "/", sameSite: "lax" });
  });

  it("still lets cookies be deleted on sign-out", () => {
    const deletion = { path: "/", maxAge: 0 };
    expect(applyRemember(deletion, false)).toEqual(deletion);
  });
});
