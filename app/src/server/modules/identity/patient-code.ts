/**
 * MediLink Patient ID (BuildPlan §8.1): application-scoped identifier with a
 * non-enumerable random component and check characters.
 *
 * Format: ML-XXXXX-XXXXX-C  where X is Crockford base32 (no I, L, O, U) and
 * C is a mod-32 check character over the 10 random body chars. Never derived
 * from name, DOB, phone, ABHA, or DB key order; possession is not
 * authorization.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford, no I L O U
const PREFIX = "ML";

function mod32Check(body: string): string {
  let acc = 0;
  for (const ch of body) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid Patient ID character: ${ch}`);
    acc = (acc * 31 + idx) % 32;
  }
  return ALPHABET[acc]!;
}

/** Generate a new random Patient ID (10 random base32 chars + check char). */
export function generatePatientCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let body = "";
  for (let i = 0; i < 10; i++) body += ALPHABET[bytes[i]! % 32];
  const check = mod32Check(body);
  return `${PREFIX}-${body.slice(0, 5)}-${body.slice(5)}-${check}`;
}

type Parsed = { body: string }; // 10 body chars + 1 check char, normalized

/**
 * Parse and normalize: uppercase, strip spaces; the literal "ML" prefix is
 * matched BEFORE transcription fixes so an "L" in the prefix never becomes
 * "1". Crockford disambiguation (I/L→1, O→0) applies to body/check only.
 */
function parse(input: string): Parsed | null {
  const m = /^ML[-\s]?([0-9A-Z]{5})[-\s]?([0-9A-Z]{5})[-\s]?([0-9A-Z])$/.exec(
    input.trim().toUpperCase().replace(/\s+/g, ""),
  );
  if (!m) return null;
  const raw = m[1]! + m[2]! + m[3]!; // 11 chars
  const body = raw.slice(0, 10).replace(/[IL]/g, "1").replace(/O/g, "0");
  const check = raw.slice(10).replace(/[IL]/g, "1").replace(/O/g, "0");
  return { body: body + check };
}

/** Validate format + check character. Returns a normalized error or null. */
export function validatePatientCode(input: string): string | null {
  const parsed = parse(input);
  if (!parsed || parsed.body.length !== 11) {
    return "Enter the Patient ID in the form ML-XXXXX-XXXXX-C (shown on the patient's card).";
  }
  for (const ch of parsed.body) {
    if (ALPHABET.indexOf(ch) < 0) {
      return `Patient ID contains an invalid character: ${ch}`;
    }
  }
  const body = parsed.body.slice(0, 10);
  const check = parsed.body.slice(10);
  if (mod32Check(body) !== check) {
    return "This Patient ID has a typo (check character does not match).";
  }
  return null;
}

/** Normalize for storage/lookup: canonical ML-XXXXX-XXXXX-C form. */
export function normalizePatientCode(input: string): string | null {
  if (validatePatientCode(input)) return null;
  const parsed = parse(input)!;
  const body = parsed.body.slice(0, 10);
  const check = parsed.body.slice(10);
  return `${PREFIX}-${body.slice(0, 5)}-${body.slice(5)}-${check}`;
}

/**
 * ABHA number: 14 digits (xx-xxxx-xxxx-xxxx) with a Verhoeff check digit —
 * the same checksum Ayushman Bharat uses. Length-only acceptance turned any
 * 14 digits (a phone suffix, a mistyped ID) into a valid lookup key.
 */
const VERHOEFF_D = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
  [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
  [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
  [9,8,7,6,5,4,3,2,1,0],
];
const VERHOEFF_P = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
  [8,9,1,6,0,4,3,7,2,5],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
  [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];

function verhoeffValid(digits: string): boolean {
  let c = 0;
  const reversed = digits.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c]![VERHOEFF_P[i % 8]![Number(reversed[i])]!]!;
  }
  return c === 0;
}

export function isAbhaNumber(input: string): boolean {
  const digits = input.replace(/[^0-9]/g, "");
  return digits.length === 14 && verhoeffValid(digits);
}
