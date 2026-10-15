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
