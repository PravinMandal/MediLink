/**
 * RangeBar compatibility gate tests (pure helper — no DB, no React render).
 * BuildPlan §7.7: a range bar renders only for numeric value + numeric
 * low/high + unit, all finite; we never compute a normal/abnormal judgement.
 */
import { describe, expect, it } from "vitest";
import {
  canRenderRangeBar,
  rangeBarCompat,
  rangeBarPosition,
} from "../src/components/range-bar";

describe("canRenderRangeBar", () => {
  it("renders when numeric value, low, high and unit are all present and finite", () => {
    expect(canRenderRangeBar(7.9, 4.0, 5.6, "g/dL")).toBe(true);
    // numeric strings from the DB numeric columns count too
    expect(canRenderRangeBar("7.9", "4.0", "5.6", "10*3/µL")).toBe(true);
  });

  it("refuses when any component is missing or non-numeric", () => {
    expect(canRenderRangeBar(7.9, null, 5.6, "g/dL")).toBe(false);
    expect(canRenderRangeBar(7.9, 4.0, null, "g/dL")).toBe(false);
    expect(canRenderRangeBar(null, 4.0, 5.6, "g/dL")).toBe(false);
    expect(canRenderRangeBar("high", 4.0, 5.6, "g/dL")).toBe(false);
    expect(canRenderRangeBar("", 4.0, 5.6, "g/dL")).toBe(false);
    expect(canRenderRangeBar(NaN, 4.0, 5.6, "g/dL")).toBe(false);
    expect(canRenderRangeBar(Infinity, 4.0, 5.6, "g/dL")).toBe(false);
  });

  it("refuses without a unit — position is meaningless without the source unit", () => {
    expect(canRenderRangeBar(7.9, 4.0, 5.6, null)).toBe(false);
    expect(canRenderRangeBar(7.9, 4.0, 5.6, "")).toBe(false);
    expect(canRenderRangeBar(7.9, 4.0, 5.6, "   ")).toBe(false);
  });

  it("refuses an inverted or degenerate source range", () => {
    expect(canRenderRangeBar(5.0, 6.0, 4.0, "g/dL")).toBe(false);
    expect(canRenderRangeBar(5.0, 4.0, 4.0, "g/dL")).toBe(false);
  });

  it("explains why rendering was skipped", () => {
    expect(rangeBarCompat(7.9, null, null, "g/dL").note).toMatch(
      /numeric reference range/i,
    );
    expect(rangeBarCompat(7.9, 4.0, 5.6, null).note).toMatch(/unit/i);
    expect(rangeBarCompat("abc", 4.0, 5.6, "g/dL").note).toMatch(
      /no numeric value/i,
    );
  });
});

describe("rangeBarPosition", () => {
  it("maps the value linearly onto the source range", () => {
    expect(rangeBarPosition(5.0, 4.0, 6.0)).toBeCloseTo(50);
    expect(rangeBarPosition(4.0, 4.0, 6.0)).toBeCloseTo(0);
    expect(rangeBarPosition(6.0, 4.0, 6.0)).toBeCloseTo(100);
  });

  it("clamps out-of-range values to 0–100 instead of escaping the bar", () => {
    expect(rangeBarPosition(7.9, 4.0, 5.6)).toBe(100);
    expect(rangeBarPosition(1.2, 4.0, 5.6)).toBe(0);
  });
});
