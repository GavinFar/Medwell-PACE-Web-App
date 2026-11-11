import { describe, expect, it } from "vitest";
import { loginErrors, passwordChecks, passwordErrors, readCode, signupErrors } from "./form-rules";

const goodSignup = {
  fullName: "Pat Volunteer",
  email: "pat@example.com",
  password: "Volunteer!1",
  confirmPassword: "Volunteer!1",
  agreeTerms: true,
  agreeSharing: true,
};

describe("passwordChecks", () => {
  it("checks length, a capital letter and a symbol separately", () => {
    expect(passwordChecks("abc")).toEqual({ length: false, upper: false, symbol: false });
    expect(passwordChecks("abcdefgh")).toEqual({ length: true, upper: false, symbol: false });
    expect(passwordChecks("Abcdefgh")).toEqual({ length: true, upper: true, symbol: false });
    expect(passwordChecks("Abcdefg!")).toEqual({ length: true, upper: true, symbol: true });
  });

  it("doesn't count spaces or digits as symbols", () => {
    expect(passwordChecks("Abc defg1").symbol).toBe(false);
    expect(passwordChecks("Abcdefg#").symbol).toBe(true);
  });
});

describe("passwordErrors", () => {
  it("accepts a password that meets every rule and matches", () => {
    expect(passwordErrors({ password: "Volunteer!1", confirmPassword: "Volunteer!1" })).toEqual({});
  });

  it("uses the design's wording", () => {
    expect(passwordErrors({ password: "", confirmPassword: "" })).toEqual({
      password: "Please create a password.",
      confirmPassword: "Please type your password again.",
    });
    expect(passwordErrors({ password: "volunteer!1", confirmPassword: "volunteer!1" }).password).toBe(
      "Your password doesn’t meet all the needs listed below yet.",
    );
    expect(passwordErrors({ password: "Volunteer!1", confirmPassword: "Volunteer!2" }).confirmPassword).toBe(
      "The two passwords don’t match.",
    );
  });

  it("refuses passwords longer than Supabase can store", () => {
    const long = `A!${"a".repeat(71)}`;
    expect(passwordErrors({ password: long, confirmPassword: long }).password).toBe(
      "Please use 72 characters or fewer.",
    );
  });
});

describe("signupErrors", () => {
  it("accepts a complete form", () => {
    expect(signupErrors(goodSignup)).toEqual({});
  });

  it("needs a name, a real email and both agreements", () => {
    expect(signupErrors({ ...goodSignup, fullName: "  ", email: "", agreeTerms: false, agreeSharing: false })).toEqual({
      fullName: "Please enter your full name.",
      email: "Please enter your email address.",
      agreeTerms: "Please tick this box to continue.",
      agreeSharing: "Please tick this box to continue.",
    });
    expect(signupErrors({ ...goodSignup, email: "pat@example" }).email).toBe(
      "Please enter a full email address, like name@example.com.",
    );
  });

  it("includes the password rules", () => {
    expect(signupErrors({ ...goodSignup, password: "short", confirmPassword: "short" }).password).toBe(
      "Your password doesn’t meet all the needs listed below yet.",
    );
  });

  it("limits the name to what the profile can store", () => {
    expect(signupErrors({ ...goodSignup, fullName: "a".repeat(81) }).fullName).toBe(
      "Please use 80 characters or fewer.",
    );
  });
});

describe("loginErrors", () => {
  it("uses the design's wording", () => {
    expect(loginErrors({ email: "", password: "" })).toEqual({
      email: "Please enter your email address.",
      password: "Please enter your password.",
    });
    expect(loginErrors({ email: "pat", password: "x" })).toEqual({
      email: "Please enter a full email address, like name@example.com.",
    });
    expect(loginErrors({ email: "pat@example.com", password: "x" })).toEqual({});
  });
});

describe("readCode", () => {
  it("accepts exactly six digits, ignoring spaces and dashes", () => {
    expect(readCode("123456")).toBe("123456");
    expect(readCode(" 123-456 ")).toBe("123456");
  });

  it("rejects anything else", () => {
    expect(readCode("12345")).toBeNull();
    expect(readCode("1234567")).toBeNull();
    expect(readCode("12a456")).toBeNull();
    expect(readCode(null)).toBeNull();
  });
});
