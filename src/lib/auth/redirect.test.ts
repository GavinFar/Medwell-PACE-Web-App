import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_LOGIN, loginUrl, safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/demo/qr")).toBe("/demo/qr");
    expect(safeNextPath("/events/42?tab=attendees")).toBe("/events/42?tab=attendees");
  });

  it("falls back to the default when missing or not a string", () => {
    expect(safeNextPath(undefined)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath(null)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath("")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath(["/a", "/b"])).toBe(DEFAULT_AFTER_LOGIN);
  });

  it("rejects links to other sites", () => {
    expect(safeNextPath("https://evil.example")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath("//evil.example")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath("/\\evil.example")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath("javascript:alert(1)")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath("evil.example")).toBe(DEFAULT_AFTER_LOGIN);
  });

  it("rejects tabs, newlines and other characters browsers strip from URLs", () => {
    // ?next=%2F%09%2Fevil.example arrives as "/<tab>/evil.example"; a browser
    // removes the tab, leaving "//evil.example", which is another site.
    expect(safeNextPath("/\t/evil.example")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath("/\n/evil.example")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath("/\r/evil.example")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath("/events\\..\\evil")).toBe(DEFAULT_AFTER_LOGIN);
  });
  
  it("doesn't send people back to the login page", () => {
    expect(safeNextPath("/login")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath("/login?next=/account")).toBe(DEFAULT_AFTER_LOGIN);
  });
});

describe("loginUrl", () => {
  it("adds where to go after logging in", () => {
    expect(loginUrl("/events/42")).toBe("/login?next=%2Fevents%2F42");
  });

  it("leaves it off for the default destination", () => {
    expect(loginUrl()).toBe("/login");
    expect(loginUrl(DEFAULT_AFTER_LOGIN)).toBe("/login");
  });
});
