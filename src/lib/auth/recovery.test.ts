import { describe, expect, it } from "vitest";
import { readRecoveryLink } from "./recovery";

describe("readRecoveryLink", () => {
  it("reads the sign-in tokens Supabase puts after the # in a reset link", () => {
    const hash =
      "#access_token=abc.def.ghi&expires_at=1&expires_in=3600&refresh_token=r3fr3sh&token_type=bearer&type=recovery";
    expect(readRecoveryLink(hash, "")).toEqual({
      kind: "tokens",
      accessToken: "abc.def.ghi",
      refreshToken: "r3fr3sh",
    });
  });

  it("treats an expired or already-used link as expired, whether the error is after # or ?", () => {
    const error = "error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
    expect(readRecoveryLink(`#${error}`, "")).toEqual({ kind: "expired" });
    expect(readRecoveryLink("", `?${error}`)).toEqual({ kind: "expired" });
  });

  it("ignores tokens that aren't from a password reset", () => {
    expect(readRecoveryLink("#access_token=a&refresh_token=b&type=signup", "")).toEqual({ kind: "none" });
  });

  it("needs both tokens", () => {
    expect(readRecoveryLink("#access_token=a&type=recovery", "")).toEqual({ kind: "expired" });
    expect(readRecoveryLink("#refresh_token=b&type=recovery", "")).toEqual({ kind: "expired" });
  });

  it("reports nothing when the page was opened without a link", () => {
    expect(readRecoveryLink("", "")).toEqual({ kind: "none" });
  });
});
