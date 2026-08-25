import { ArrowDown, ArrowUp, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Compatibility gate (BuildPlan §7.7)                                 */
/* ------------------------------------------------------------------ */

export type UnitCompat = {
  /** Numeric value + numeric low + numeric high + unit, all finite, low < high. */
  canRender: boolean;
  /** Human explanation when rendering is skipped (unit notes / missing pieces). */
  note: string;
};

/**
 * A range bar is rendered only when the source provided a numeric value, a
 * numeric low AND high reference bound, and a unit — all finite, with
 * low < high. We NEVER compute a normal/abnormal judgement of our own: the
 * source's own flag is displayed verbatim.
 */
export function rangeBarCompat(
  value: unknown,
  low: unknown,
  high: unknown,
  unit: unknown,
): UnitCompat {
  const numeric = (v: unknown): number | null => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  if (numeric(value) === null)
    return { canRender: false, note: "No numeric value reported." };
  if (numeric(low) === null || numeric(high) === null)
    return {
      canRender: false,
      note: "The source did not provide a numeric reference range.",
    };
  if (typeof unit !== "string" || unit.trim() === "")
    return {
      canRender: false,
      note: "No unit reported — a range position would be meaningless without the source unit.",
    };
  const l = numeric(low)!;
  const h = numeric(high)!;
  if (l >= h)
    return {
      canRender: false,
      note: "The source reference range is not usable (low bound is not below the high bound).",
    };
  return { canRender: true, note: "" };
}

/** Convenience boolean wrapper. */
export function canRenderRangeBar(
  value: unknown,
  low: unknown,
  high: unknown,
  unit: unknown,
): boolean {
  return rangeBarCompat(value, low, high, unit).canRender;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Position of the value on a 0–100% linear scale, clamped. */
export function rangeBarPosition(
  value: number,
  low: number,
  high: number,
): number {
  const pct = ((value - low) / (high - low)) * 100;
  return Math.min(100, Math.max(0, pct));
}

const FLAG_LABEL: Record<string, string> = {
  high: "above the source reference range",
  low: "below the source reference range",
  critical: "critical — as flagged by the source lab",
  normal: "within the source reference range",
  unknown: "the source did not flag this value",
};

function FlagLabel({ flag }: { flag: string | null | undefined }) {
  const f = flag ?? "unknown";
  const tone =
    f === "critical"
      ? "text-alert"
      : f === "high" || f === "low"
        ? "text-amber"
        : "text-ink-soft";
  const Icon =
    f === "critical"
      ? TriangleAlert
      : f === "high"
        ? ArrowUp
        : f === "low"
          ? ArrowDown
          : null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12px] font-medium", tone)}>
      {Icon ? <Icon size={13} aria-hidden /> : null}
      <span>
        Source flag: {f}
        {FLAG_LABEL[f] ? ` — ${FLAG_LABEL[f]}` : ""}
      </span>
    </span>
  );
}

/**
 * RangeBar (BuildPlan §7.7 / §7.5): renders only when the source supplied a
 * numeric value, a numeric low+high reference range, and a unit. Position is
 * clamped to 0–100%. The source's own flag is kept verbatim as text + icon;
 * no new normal/abnormal judgement is ever computed. Shape (marker), text
 * label, and position carry meaning — color only reinforces.
 */
export function RangeBar({
  value,
  low,
  high,
  unit,
  flag,
  name,
  date,
  className,
}: {
  value: unknown;
  low: unknown;
  high: unknown;
  unit: unknown;
  flag?: string | null;
  name?: string | null;
  date?: string | null;
  className?: string;
}) {
  const compat = rangeBarCompat(value, low, high, unit);

  const valueText = (v: unknown) => {
    const n = toNumber(v);
    if (n === null) return String(v ?? "—");
    return String(Math.round(n * 1000) / 1000);
  };

  if (!compat.canRender) {
    return (
      <p className={cn("text-[12px] leading-relaxed text-ink-soft", className)}>
        <span className="num font-medium text-ink">
          {valueText(value)} {typeof unit === "string" && unit ? unit : ""}
        </span>
        {" — "}
        {compat.note}
        {typeof flag === "string" && flag !== "unknown" && flag
          ? ` (source flag: ${flag})`
          : ""}
      </p>
    );
  }

  const v = toNumber(value)!;
  const l = toNumber(low)!;
  const h = toNumber(high)!;
  const pos = rangeBarPosition(v, l, h);
  const clamped = v < l || v > h;
  const markerShape = clamped ? "rotate-45" : ""; // diamond outside range, circle inside

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="num text-[15px] font-semibold text-ink">
          {valueText(v)}{" "}
          <span className="text-[11px] font-normal text-ink-soft">{String(unit)}</span>
        </p>
        <FlagLabel flag={flag} />
      </div>
      <div
        role="img"
        aria-label={`${name ? `${name}: ` : ""}${valueText(v)} ${String(unit)} — source reference range ${valueText(l)} to ${valueText(h)} ${String(unit)}${clamped ? "; the value lies outside the source range" : "; the value lies within the source range"}${flag && flag !== "unknown" ? `; source flag: ${flag}` : ""}`}
        className="relative h-6 max-w-md"
      >
        {/* reference-range band */}
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-line"
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full border-l-2 border-r-2 border-pine/40 bg-pine-tint left-[12.5%] w-[75%]"
        />
        {/* low / high ticks */}
        <span aria-hidden className="num absolute left-[12.5%] top-full -translate-x-1/2 text-[9.5px] text-ink-faint">
          {valueText(l)}
        </span>
        <span aria-hidden className="num absolute left-[87.5%] top-full -translate-x-1/2 text-[9.5px] text-ink-faint">
          {valueText(h)}
        </span>
        {/* value marker: diamond when outside the band, circle when inside */}
        <span
          aria-hidden
          style={{ left: `calc(${pos}% - 6px)` }}
          className={cn(
            "absolute top-1/2 h-3 w-3 -translate-y-1/2 border-2",
            markerShape,
            clamped
              ? "border-amber bg-paper-raised"
              : "border-pine bg-pine",
          )}
        />
      </div>
      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        {valueText(v)} {String(unit)} (source range {valueText(l)}–{valueText(h)}{" "}
        {String(unit)}
        {flag && flag !== "unknown"
          ? `, source flag: ${flag} — the source lab reported this ${FLAG_LABEL[flag] ?? flag}`
          : " — the source lab did not flag this value"}
        {date ? `. Collected ${date}.` : "."} MediLink does not re-evaluate
        whether this value is normal.
      </p>
    </div>
  );
}
