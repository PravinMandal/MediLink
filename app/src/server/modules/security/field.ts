/**
 * Action input clamps (overhaul round 8).
 *
 * Every server action read free text with `String(formData.get(...))` and no
 * upper bound — a single 10 MB note/reason/title would ride straight into
 * Postgres (DB bloat) and back out into other users' browsers (stored-XSS
 * payload budget). Minimums existed (`reason.length < 10`) but no maximums.
 *
 * `field()` trims + hard-caps; actions reject over-limit input with a
 * field-safe message instead of silently truncating (silent truncation
 * corrupts clinical meaning — "metformin 500…" is worse than an error).
 */
export const FIELD_LIMITS = {
  /** names, titles, substances, medications, single-line identifiers */
  short: 200,
  /** doses, frequencies, reactions, criticality, units, panels */
  medium: 500,
  /** notes, reasons, outcomes, bodies, multi-line clinical text */
  long: 5000,
} as const;

export function field(
  raw: FormDataEntryValue | null,
  max: number,
  opts?: { label?: string; required?: boolean },
): { ok: true; value: string } | { ok: false; error: string } {
  const label = opts?.label ?? "This field";
  const value = String(raw ?? "").trim();
  if (!value && opts?.required) return { ok: false, error: `${label} is required.` };
  if (value.length > max)
    return {
      ok: false,
      error: `${label} is too long (max ${max} characters). Shorten it and try again.`,
    };
  return { ok: true, value };
}

/** Optional-field variant: empty stays undefined, over-limit still rejects. */
export function optField(
  raw: FormDataEntryValue | null,
  max: number,
  opts?: { label?: string },
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: true, value: undefined };
  const r = field(raw, max, opts);
  return r.ok ? { ok: true, value: r.value } : r;
}
