import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkPassword,
  createSessionCookieValue,
  verifySessionCookieValue,
} from "./auth";

describe("auth", () => {
  const originalPassword = process.env.APP_PASSWORD;

  beforeEach(() => {
    process.env.APP_PASSWORD = "correct-horse-battery-staple";
  });

  afterEach(() => {
    process.env.APP_PASSWORD = originalPassword;
  });

  describe("checkPassword", () => {
    it("returns true for the correct password", () => {
      expect(checkPassword("correct-horse-battery-staple")).toBe(true);
    });

    it("returns false for an incorrect password", () => {
      expect(checkPassword("wrong")).toBe(false);
    });
  });

  describe("session cookie round-trip", () => {
    it("verifies a cookie value it created", () => {
      const cookieValue = createSessionCookieValue();
      expect(verifySessionCookieValue(cookieValue)).toBe(true);
    });

    it("rejects a tampered cookie value", () => {
      const cookieValue = createSessionCookieValue();
      const tampered = cookieValue.slice(0, -1) + (cookieValue.endsWith("a") ? "b" : "a");
      expect(verifySessionCookieValue(tampered)).toBe(false);
    });

    it("rejects an undefined cookie value", () => {
      expect(verifySessionCookieValue(undefined)).toBe(false);
    });
  });
});
