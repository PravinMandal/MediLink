/**
 * Emergency Card — wallet/lock-screen-sized card rendering (print-optimized).
 * Pure server-rendered SVG/HTML; no JS needed. The QR resolves to the app's
 * emergency entry (sign-in → break-glass), so a treating doctor with any
 * phone reaches the audited path instead of an unaudited paper printout.
 */
import { formatDate } from "@/lib/utils";

export type EmergencyCardData = {
  patientName: string;
  patientId: string;
  sex: string | null;
  dob: string | null;
  bloodGroup: string;
  bloodGroupVerified: boolean;
  allergies: Array<{ substance: string; criticality: string | null; reaction: string | null }>;
  meds: Array<{ medication: string; dose: string | null; frequency: string | null }>;
  conditions: Array<{ name: string; onsetDate: string | null }>;
  ecName: string | null;
  ecPhone: string | null;
  emergencyUrl: string;
};

/* QR (version-auto, error-correction M) generated inline below — a tiny
   segment-based encoder for a short alphanumeric URL keeps this dependency-
   free. For long URLs we fall back to a plain code. */
function qrMatrix(text: string): boolean[][] | null {
  try {
    // Byte-mode encoding handles arbitrary payloads; the version check inside
    // bounds it to what our minimal encoder supports.
    return byteModeQr(text);
  } catch {
    return null;
  }
}

/* Minimal byte-mode QR encoder (versions 1-10, ECC M). Enough for URLs. */
function byteModeQr(data: string): boolean[][] | null {
  const bytes = new TextEncoder().encode(data);
  // Choose version: capacity (ECC M, byte mode) for versions 1..10
  const cap = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
  let version = 0;
  while (version < cap.length && cap[version]! < bytes.length + 2) version++;
  if (version >= cap.length) return null;
  const v = version + 1;

  const dataCW = [16, 28, 44, 64, 86, 108, 124, 154, 182, 216];
  const ecPerBlock = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const blocks = [1, 1, 1, 2, 2, 4, 4, 4, 5, 6];
  const size = 17 + 4 * v;
  // Build bitstream
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, v <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const dataBits = 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
  const totalBits = dataCW[version]! * 8;
  // terminator
  for (let i = 0; i < Math.min(4, totalBits - dataBits); i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  // pad bytes
  const padToggle = [0xec, 0x11];
  let pi = 0;
  while (bits.length < totalBits) {
    push(padToggle[pi % 2]!, 8);
    pi++;
  }
  // to bytes
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]!;
    codewords.push(b);
  }

  // RS(255,k) over GF(256), primitive 0x11d
  const exp = new Array<number>(512).fill(0);
  const log = new Array<number>(256).fill(0);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255]!;
  const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : exp[log[a]! + log[b]!]!);
  const rsGen = (nd: number) => {
    let poly = [1];
    for (let i = 0; i < nd; i++) {
      const next = new Array<number>(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j]!;
        next[j + 1] ^= mul(poly[j]!, exp[i]!);
      }
      poly = next;
    }
    return poly;
  };
  const rsEncode = (data: number[], nd: number) => {
    const gen = rsGen(nd);
    const res = data.concat(new Array<number>(nd).fill(0));
    for (let i = 0; i < data.length; i++) {
      const factor = res[i]!;
      if (factor === 0) continue;
      for (let j = 1; j < gen.length; j++) res[i + j]! ^= mul(gen[j]!, factor);
    }
    return res.slice(data.length);
  };

  // Split into blocks, compute ECC, interleave. v1–6 ECC-M all use
  // equal-sized data blocks, so per = dataCW / blocks is exact.
  if (v > 6) return null;
  const btotal = blocks[version]!;
  const per = dataCW[version]! / btotal;
  const dataBlocks: number[][] = [];
  for (let i = 0; i < btotal; i++) dataBlocks.push(codewords.slice(i * per, (i + 1) * per));
  const ecBlocks = dataBlocks.map((db) => rsEncode(db, ecPerBlock[version]!));
  const final: number[] = [];
  for (let i = 0; i < per; i++) for (const db of dataBlocks) final.push(db[i]!);
  for (let i = 0; i < ecPerBlock[version]!; i++) for (const eb of ecBlocks) final.push(eb[i]!);
  // Matrix
  const m: (0 | 1 | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null));
  const setFn = (r: number, c: number, val: boolean) => {
    m[r]![c] = val ? 1 : 0;
  };
  // finder patterns
  const finder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const rr = row + r;
        const cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const on =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setFn(rr, cc, on);
      }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);
  // timing
  for (let i = 8; i < size - 8; i++) {
    if (m[6]![i] === null) setFn(6, i, i % 2 === 0);
    if (m[i]![6] === null) setFn(i, 6, i % 2 === 0);
  }
  // alignment patterns (versions 2+; positions for v2..6)
  const alignPos: Record<number, number[]> = {
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
  };
  const apos = alignPos[v];
  if (apos)
    for (const r of apos)
      for (const c of apos) {
        if (m[r]![c] !== null) continue;
        for (let dr = -2; dr <= 2; dr++)
          for (let dc = -2; dc <= 2; dc++) {
            const on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            setFn(r + dr, c + dc, on);
          }
      }
  // Format info and dark module are set after data placement (below).

  // Reserve format-info cells BEFORE data placement (values written after).
  const fmt1Reserve: Array<[number, number]> = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const fmt2Reserve: Array<[number, number]> = [];
  for (let i = 0; i < 7; i++) fmt2Reserve.push([size - 1 - i, 8]);
  for (let i = 0; i < 8; i++) fmt2Reserve.push([8, size - 8 + i]);
  for (const [r, c] of [...fmt1Reserve, ...fmt2Reserve]) m[r]![c] = 0;
  // Dark module (always set)
  m[size - 8]![8] = 1;

  // Place data with mask 0
  let dir = -1; // upward first (placement starts bottom-right)
  let row = size - 1;
  let bitIdx = 0;
  const totalModules = final.length * 8;
  const getBit = (i: number) => (i < totalModules ? ((final[i >> 3]! >> (7 - (i % 8))) & 1) === 1 : false);
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip timing column
    while (row >= 0 && row < size) {
      for (const c of [col, col - 1]) {
        if (m[row]![c] === null) {
          let bit = getBit(bitIdx);
          bitIdx++;
          // mask 0: (row+col) % 2 == 0
          if ((row + c) % 2 === 0) bit = !bit;
          setFn(row, c, bit);
        }
      }
      row += dir;
    }
    dir = -dir;
    row += dir;
  }
  // Format information, ECC level M (00), mask pattern 0 → standard
  // table value 101010000010010. Two copies: around the top-left finder,
  // and split along the bottom/right edges.
  const fmt = "101010000010010";
  const copy1: Array<[number, number]> = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const copy2: Array<[number, number]> = [];
  for (let i = 0; i < 7; i++) copy2.push([size - 1 - i, 8]); // bits 0-6 down col 8
  for (let i = 0; i < 8; i++) copy2.push([8, size - 8 + i]); // bits 7-14 across row 8
  copy1.forEach(([r, c], i) => {
    m[r]![c] = fmt[i] === "1" ? 1 : 0;
  });
  copy2.forEach(([r, c], i) => {
    m[r]![c] = fmt[i] === "1" ? 1 : 0;
  });
  // Dark module (always set)
  m[size - 8]![8] = 1;

  return m.map((row2) => row2.map((cell) => cell === 1));
}

export function EmergencyCard({ data }: { data: EmergencyCardData }) {
  const qr = qrMatrix(data.emergencyUrl);
  const criticalAllergies = data.allergies
    .filter((a) => (a.criticality ?? "").toLowerCase().match(/high|critical/))
    .slice(0, 4);
  const otherAllergies = data.allergies.filter((a) => !criticalAllergies.includes(a)).slice(0, 3);
  const qrSize = qr ? qr.length : 0;

  return (
    <section
      aria-label="Emergency card"
      className="print-card relative overflow-hidden rounded-xl border-2 border-alert bg-paper-raised"
    >
      {/* header band */}
      <div className="flex items-center justify-between bg-alert px-4 py-2.5 text-white">
        <p className="font-display text-[15px] font-bold uppercase tracking-wide">
          ⛑ Medical alert
        </p>
        <p className="num text-[10px] font-medium uppercase tracking-widest text-white/85">
          MediLink verified record
        </p>
      </div>

      <div className="flex gap-4 px-4 py-4">
        {/* left: identity + blood */}
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-display text-[19px] font-semibold leading-tight text-ink">
              {data.patientName}
            </p>
            <p className="num text-[11px] text-ink-soft">
              {data.sex ? `${data.sex.toUpperCase()} · ` : ""}
              {data.dob ? formatDate(data.dob) : ""}
              {data.dob ? "" : "DOB unknown"}
            </p>
          </div>
          <div className="inline-flex items-baseline gap-2">
            <span className="num font-display text-[38px] font-bold leading-none text-alert">
              {data.bloodGroup}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
              {data.bloodGroupVerified ? "lab-verified" : "self-reported"}
            </span>
          </div>
          {criticalAllergies.length ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-alert">
                Dangerous allergies
              </p>
              <ul className="mt-0.5">
                {criticalAllergies.map((a) => (
                  <li key={a.substance} className="text-[13px] font-semibold text-alert">
                    {a.substance}
                    <span className="font-normal text-ink-soft">
                      {" "}
                      {[a.criticality, a.reaction].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {otherAllergies.length ? (
            <p className="text-[11px] text-ink-soft">
              Also: {otherAllergies.map((a) => a.substance).join(", ")}
            </p>
          ) : null}
        </div>

        {/* right: QR + emergency contact */}
        <div className="flex w-28 shrink-0 flex-col items-center gap-2">
          {qr ? (
            <svg
              viewBox={`0 0 ${qrSize + 8} ${qrSize + 8}`}
              className="h-28 w-28"
              role="img"
              aria-label={`QR code linking to the MediLink emergency profile for ${data.patientName}`}
            >
              <rect width={qrSize + 8} height={qrSize + 8} fill="#ffffff" />
              {qr.flatMap((rowArr, r) =>
                rowArr.map((on, c) =>
                  on ? (
                    <rect key={`${r}-${c}`} x={c + 4} y={r + 4} width={1} height={1} fill="#1b2420" />
                  ) : null,
                ),
              )}
            </svg>
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-md border border-dashed border-line-strong text-center text-[9px] leading-tight text-ink-faint">
              scan at
              <br />
              {data.emergencyUrl.replace(/^https?:\/\//, "")}
            </div>
          )}
          <p className="text-center text-[8.5px] leading-tight text-ink-faint">
            Scan → audited emergency access
          </p>
          {data.ecName || data.ecPhone ? (
            <div className="w-full border-t border-line pt-1.5 text-center">
              <p className="text-[8.5px] font-bold uppercase tracking-wide text-ink-soft">ICE</p>
              <p className="text-[10px] font-medium leading-tight text-ink">{data.ecName}</p>
              {data.ecPhone ? (
                <p className="num text-[10px] text-ink-soft">{data.ecPhone}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* footer: conditions/meds micro-rows */}
      {data.conditions.length || data.meds.length ? (
        <div className="space-y-1 border-t border-line px-4 py-2.5">
          {data.conditions.length ? (
            <p className="text-[10.5px] leading-snug text-ink">
              <span className="font-bold">Conditions:</span>{" "}
              {data.conditions.slice(0, 4).map((c) => c.name).join(" · ")}
            </p>
          ) : null}
          {data.meds.length ? (
            <p className="text-[10.5px] leading-snug text-ink">
              <span className="font-bold">Medications:</span>{" "}
              {data.meds.slice(0, 5).map((m) => m.medication).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="bg-paper-sunk px-4 py-1.5 text-[8.5px] text-ink-faint">
        Treating clinician: scan the code or visit MediLink and use emergency access — every read
        is audited and the patient is notified. Card shows data as of today.
      </p>
    </section>
  );
}
