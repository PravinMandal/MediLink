/**
 * Field-clamp unit tests (overhaul round 8): action inputs must reject
 * over-limit text with a safe message instead of riding unbounded into
 * Postgres, and must never silently truncate clinical meaning.
 */
import { describe, expect, it } from "vitest";
import { field, optField, FIELD_LIMITS } from "../src/server/modules/security/field";

describe("field()", () => {
  it("accepts in-limit text trimmed", () => {
    const r = field("  Metformin  ", FIELD_LIMITS.short, { label: "Medication" });
    expect(r).toEqual({ ok: true, value: "Metformin" });
  });

  it("rejects required-but-empty", () => {
    const r = field("   ", FIELD_LIMITS.short, { label: "Condition name", required: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/required/);
  });

  it("rejects over-limit text without truncating", () => {
    const big = "x".repeat(FIELD_LIMITS.short + 1);
    const r = field(big, FIELD_LIMITS.short, { label: "Medication name" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/too long/);
      expect(r.error).toMatch(/200/);
    }
  });
});

describe("new call-site limits", () => {
  it("rejects over-limit reason (long, 5000)", () => {
    const big = "r".repeat(FIELD_LIMITS.long + 1);
    expect(field(big, FIELD_LIMITS.long, { label: "Reason", required: true }).ok).toBe(false);
  });

  it("rejects over-limit id (short, 200)", () => {
    const big = "i".repeat(FIELD_LIMITS.short + 1);
    const r = field(big, FIELD_LIMITS.short, { label: "Document", required: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/200/);
  });

  it("rejects over-limit password budget (512, never truncates)", () => {
    // Mirrors PASSWORD_MAX in auth-actions: reject, don't truncate.
    const big = "p".repeat(513);
    expect(field(big, 512, { label: "Password" }).ok).toBe(false);
    expect(field("p".repeat(512), 512, { label: "Password" })).toEqual({
      ok: true,
      value: "p".repeat(512),
    });
  });

  it("accepts optional purpose detail within long limit", () => {
    const r = optField("Follow-up visit", FIELD_LIMITS.long, { label: "Purpose detail" });
    expect(r).toEqual({ ok: true, value: "Follow-up visit" });
  });

  it("rejects over-limit optional notes", () => {
    const big = "n".repeat(FIELD_LIMITS.long + 1);
    const r = optField(big, FIELD_LIMITS.long, { label: "Notes" });
    expect(r.ok).toBe(false);
  });
});

describe("optField()", () => {
  it("maps empty to undefined", () => {
    expect(optField(null, FIELD_LIMITS.long)).toEqual({ ok: true, value: undefined });
    expect(optField("  ", FIELD_LIMITS.long)).toEqual({ ok: true, value: undefined });
  });

  it("rejects over-limit optional text", () => {
    const big = "y".repeat(FIELD_LIMITS.long + 1);
    const r = optField(big, FIELD_LIMITS.long, { label: "Notes" });
    expect(r.ok).toBe(false);
  });
});
