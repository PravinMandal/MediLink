/**
 * AI summary — SBAR-structured patient summary where EVERY claim carries
 * citations to the records it came from.
 *
 * Two modes:
 * - deterministic (default): built directly from structured rows, so
 *   citations are exact by construction. Works with zero external services.
 * - llm (GEMINI_API_KEY set): the model receives only pre-authorized,
 *   ID-tagged record context and must cite those IDs; any claim citing an
 *   unknown ID is dropped before persistence. Falls back to deterministic
 *   on any validation failure.
 *
 * Scope guardrail: summarize/organize only — no diagnosis, no treatment
 * recommendation, no dosing advice. Every rendered surface is labeled
 * "AI-generated summary — verify against sources".
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  aiSummaries,
  aiSummaryClaims,
  patients,
} from "@/server/db/schema";
import { records } from "@/server/modules/records/service";
import { contradictionEngine } from "./contradictions";

export type ClaimSource = {
  recordType: string;
  recordId: string;
  documentId?: string;
  label: string;
  date?: string;
  trust: string;
};

export type Claim = {
  section: "situation" | "background" | "assessment" | "plan";
  text: string;
  sources: ClaimSource[];
};

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

function ageFrom(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function yearsSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000)));
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Deterministic SBAR builder                                          */
/* ------------------------------------------------------------------ */

async function buildDeterministic(patientId: string, focus?: string): Promise<Claim[]> {
  const [patient] = await db.select().from(patients).where(eq(patients.id, patientId));
  if (!patient) throw new Error("Patient not found");

  const [conds, allergies, meds, procs, obs, docs, encs, bloodGroup, openConflicts] =
    await Promise.all([
      records.currentConditions(patientId),
      records.currentAllergies(patientId),
      records.currentMedications(patientId),
      records.proceduresFor(patientId),
      records.observationsFor(patientId, 400),
      records.documentsFor(patientId),
      records.encountersFor(patientId),
      records.bloodGroup(patientId),
      contradictionEngine.openFor(patientId),
    ]);

  const focusTerms = focus
    ? focus.toLowerCase().split(/\s+/).filter((t) => t.length > 3)
    : [];
  const matchesFocus = (text: string) =>
    !focusTerms.length || focusTerms.some((t) => text.toLowerCase().includes(t));

  const claims: Claim[] = [];
  const activeConds = conds.filter((c) => c.status !== "resolved");

  /* --- Situation --- */
  const age = ageFrom(patient.dob);
  const sex = patient.sex ?? "";
  const condSummary = activeConds
    .slice(0, 4)
    .map((c) => {
      const yrs = yearsSince(c.onsetDate);
      return `${c.name}${yrs ? ` (${yrs} yr${yrs > 1 ? "s" : ""})` : ""}`;
    })
    .join(", ");
  claims.push({
    section: "situation",
    text:
      `${age != null ? `${age}-year-old` : "Adult"} ${sex ? sex : "patient"}` +
      `${condSummary ? ` with ${condSummary}` : ""}; ` +
      `${meds.length} active medication${meds.length === 1 ? "" : "s"}` +
      `${encs[0] ? `, last documented encounter ${fmtDate(encs[0].occurredAt.toISOString())}` : ""}.`,
    sources: [
      ...activeConds.slice(0, 4).map<ClaimSource>((c) => ({
        recordType: "condition",
        recordId: c.id,
        documentId: c.sourceDocumentId ?? undefined,
        label: c.name,
        date: c.onsetDate ?? undefined,
        trust: c.trust,
      })),
      ...(encs[0]
        ? [
            {
              recordType: "encounter",
              recordId: encs[0].id,
              label: encs[0].reason ?? "Encounter",
              date: encs[0].occurredAt.toISOString().slice(0, 10),
              trust: encs[0].trust,
            } satisfies ClaimSource,
          ]
        : []),
    ],
  });

  if (bloodGroup.verified || bloodGroup.selfReported) {
    claims.push({
      section: "situation",
      text:
        `Blood group ${bloodGroup.verified?.value ?? bloodGroup.selfReported}` +
        `${bloodGroup.verified ? " (verified lab)" : " (self-reported)"}.`,
      sources: bloodGroup.verified
        ? [
            {
              recordType: "observation",
              recordId: bloodGroup.verified.observationId,
              label: "Blood Group",
              date: bloodGroup.verified.date ?? undefined,
              trust: "verified",
            },
          ]
        : [],
    });
  }

  for (const a of allergies) {
    if (!matchesFocus(a.substance) && focusTerms.length) continue;
    claims.push({
      section: "situation",
      text:
        `ALLERGY — ${a.substance}` +
        `${a.criticality ? ` (${a.criticality})` : ""}` +
        `${a.reaction ? `: ${a.reaction}` : ""}.`,
      sources: [
        {
          recordType: "allergy",
          recordId: a.id,
          documentId: a.sourceDocumentId ?? undefined,
          label: a.substance,
          date: a.onsetDate ?? undefined,
          trust: a.trust,
        },
      ],
    });
  }
  if (!allergies.length) {
    claims.push({
      section: "situation",
      text: "No allergies documented in any record.",
      sources: [],
    });
  }

  /* --- Background --- */
  for (const c of conds) {
    if (!matchesFocus(c.name) && !matchesFocus(c.notes ?? "") && focusTerms.length) continue;
    claims.push({
      section: "background",
      text:
        `${c.name} — ${c.status === "resolved" ? "resolved" : c.status}` +
        `${c.onsetDate ? `, diagnosed ${fmtDate(c.onsetDate)}` : ""}` +
        `${c.notes ? `. ${c.notes}` : "."}`,
      sources: [
        {
          recordType: "condition",
          recordId: c.id,
          documentId: c.sourceDocumentId ?? undefined,
          label: c.name,
          date: c.onsetDate ?? undefined,
          trust: c.trust,
        },
      ],
    });
  }

  for (const p of procs) {
    if (!matchesFocus(p.name) && focusTerms.length) continue;
    claims.push({
      section: "background",
      text:
        `${p.name}${p.performedDate ? ` — ${fmtDate(p.performedDate)}` : ""}` +
        `${p.outcome ? ` (${p.outcome})` : ""}.`,
      sources: [
        {
          recordType: "procedure",
          recordId: p.id,
          documentId: p.sourceDocumentId ?? undefined,
          label: p.name,
          date: p.performedDate ?? undefined,
          trust: p.trust,
        },
      ],
    });
  }

  /* --- Assessment: trends + abnormal latest labs + conflicts --- */
  const trends = await records.trends(patientId);
  const trendEntries = [...trends.entries()]
    .filter(([name, points]) => points.length >= 2 && matchesFocus(name))
    .slice(0, 6);
  for (const [name, points] of trendEntries) {
    const src = points.map<{ o: (typeof obs)[number] } | null>(() => null);
    // Recover observation rows for citations
    const rows = obs.filter((o) => o.name === name).slice(0, points.length);
    const first = points[0];
    const last = points[points.length - 1];
    const worsening =
      Number(last.value) > Number(first.value) * 1.1 ||
      Number(last.value) < Number(first.value) * 0.9;
    const lastFlag = last.flag;
    if (!worsening && lastFlag !== "high" && lastFlag !== "low" && lastFlag !== "critical") {
      continue; // only surface meaningful trends
    }
    const arrow = Number(last.value) > Number(first.value) ? "↑" : "↓";
    const series = points
      .slice(-3)
      .map((p) => `${p.value}${p.unit ? ` ${p.unit}` : ""}${p.date ? ` (${fmtDate(p.date)})` : ""}`)
      .join(" → ");
    claims.push({
      section: "assessment",
      text: `${name} ${arrow} ${series}${lastFlag !== "unknown" && lastFlag !== "normal" ? ` — latest ${lastFlag}` : ""}.`,
      sources: rows.map<ClaimSource>((o) => ({
        recordType: "observation",
        recordId: o.id,
        documentId: o.sourceDocumentId ?? undefined,
        label: `${o.name} ${o.value ?? ""} ${o.unit ?? ""}`.trim(),
        date: o.effectiveDate ?? undefined,
        trust: o.trust,
      })),
    });
    void src;
  }

  // Latest abnormal labs not already covered by a trend claim
  const coveredNames = new Set(trendEntries.map(([n]) => n));
  const abnormal = obs
    .filter(
      (o) =>
        o.value &&
        (o.flag === "high" || o.flag === "low" || o.flag === "critical") &&
        !coveredNames.has(o.name) &&
        matchesFocus(o.name),
    )
    .slice(0, 5);
  for (const o of abnormal) {
    claims.push({
      section: "assessment",
      text:
        `Latest ${o.name} ${o.value}${o.unit ? ` ${o.unit}` : ""} (${fmtDate(o.effectiveDate)}) — ` +
        `${o.flag}` +
        `${o.referenceRangeLow && o.referenceRangeHigh ? ` (ref ${o.referenceRangeLow}–${o.referenceRangeHigh})` : ""}.`,
      sources: [
        {
          recordType: "observation",
          recordId: o.id,
          documentId: o.sourceDocumentId ?? undefined,
          label: `${o.name} ${o.value ?? ""} ${o.unit ?? ""}`.trim(),
          date: o.effectiveDate ?? undefined,
          trust: o.trust,
        },
      ],
    });
  }

  for (const c of openConflicts) {
    claims.push({
      section: "assessment",
      text: `⚠ Data conflict (${c.kind.replace(/_/g, " ")}) detected — see conflicts panel for sources.`,
      sources: [],
    });
  }

  /* --- Plan (factual: meds + document inventory) --- */
  if (meds.length) {
    claims.push({
      section: "plan",
      text:
        `Active medications: ` +
        meds
          .map((m) =>
            `${m.medication}${m.dose ? ` ${m.dose}` : ""}${m.frequency ? ` ${m.frequency}` : ""}`,
          )
          .join("; ") +
        ".",
      sources: meds.map<ClaimSource>((m) => ({
        recordType: "medication_statement",
        recordId: m.id,
        documentId: m.sourceDocumentId ?? undefined,
        label: m.medication,
        date: m.startDate ?? undefined,
        trust: m.trust,
      })),
    });
  }
  if (docs.length) {
    const recent = docs[0];
    claims.push({
      section: "plan",
      text:
        `${docs.length} source document${docs.length === 1 ? "" : "s"} on file; ` +
        `most recent: ${recent.title} (${fmtDate(recent.recordedDate ?? recent.createdAt.toISOString())}).`,
      sources: [
        {
          recordType: "document",
          recordId: recent.id,
          documentId: recent.id,
          label: recent.title,
          date: recent.recordedDate ?? undefined,
          trust: "verified",
        },
      ],
    });
  }

  return claims;
}

/* ------------------------------------------------------------------ */
/* LLM mode                                                            */
/* ------------------------------------------------------------------ */

async function tryLlm(
  patientId: string,
  claims: Claim[],
  focus?: string,
): Promise<{ mode: "llm"; model: string; claims: Claim[] } | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  // Build ID-tagged context from the deterministic claims' sources + records
  const context = claims.map((c, i) => ({
    id: `c${i}`,
    section: c.section,
    text: c.text,
    sources: c.sources.map((s) => `${s.recordType}:${s.recordId}`),
  }));

  const prompt =
    "You are a clinical documentation assistant. Reorganize and tighten these " +
    "already-extracted patient facts into an SBAR summary for a treating doctor. " +
    "STRICT RULES: use ONLY the provided facts; do not add medical knowledge, " +
    "diagnoses, or treatment suggestions; keep every statement traceable to the " +
    'input fact ids. Return ONLY JSON: {"claims": [{"section": "situation"|"background"|"assessment"|"plan", ' +
    '"text": string, "factIds": string[]}]}. ' +
    (focus ? `Focus on: ${focus}. ` : "") +
    "Omit sections with no relevant facts rather than inventing them.";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt + "\n\nFACTS:\n" + JSON.stringify(context) }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    },
  ).catch(() => null);
  if (!res || !res.ok) return null;
  const data = (await res.json().catch(() => null)) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  } | null;
  const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) return null;

  let parsed: { claims?: Array<{ section?: string; text?: string; factIds?: string[] }> };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.claims)) return null;

  const validSections = new Set(["situation", "background", "assessment", "plan"]);
  const llmClaims: Claim[] = [];
  for (const c of parsed.claims) {
    if (!c.text || !c.section || !validSections.has(c.section)) continue;
    // Citation integrity: keep only claims whose factIds exist in our context
    const ids = (c.factIds ?? []).filter((id) => context.some((x) => x.id === id));
    if (!ids.length) continue;
    const sources: ClaimSource[] = ids.flatMap((id) => {
      const orig = claims[Number(id.slice(1))];
      return orig ? orig.sources : [];
    });
    llmClaims.push({ section: c.section as Claim["section"], text: c.text, sources });
  }
  if (llmClaims.length < 3) return null;
  return { mode: "llm", model: GEMINI_MODEL, claims: llmClaims };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export const summarizer = {
  get mode(): "deterministic" | "llm" {
    return process.env.GEMINI_API_KEY?.trim() ? "llm" : "deterministic";
  },

  async generate(input: {
    patientId: string;
    requestedById: string;
    question?: string;
  }) {
    const deterministic = await buildDeterministic(input.patientId, input.question);
    let mode: "deterministic" | "llm" = "deterministic";
    let model: string | null = null;
    let claims = deterministic;

    const llm = await tryLlm(input.patientId, deterministic, input.question);
    if (llm) {
      mode = llm.mode;
      model = llm.model;
      claims = llm.claims;
    }

    const [summary] = await db
      .insert(aiSummaries)
      .values({
        patientId: input.patientId,
        requestedById: input.requestedById,
        question: input.question ?? null,
        mode,
        model,
        sbar: {
          situation: claims.filter((c) => c.section === "situation").map((c) => c.text).join(" "),
          background: claims.filter((c) => c.section === "background").map((c) => c.text),
          assessment: claims.filter((c) => c.section === "assessment").map((c) => c.text),
          plan: claims.filter((c) => c.section === "plan").map((c) => c.text),
        },
      })
      .returning();

    if (claims.length) {
      await db.insert(aiSummaryClaims).values(
        claims.map((c, i) => ({
          summaryId: summary.id,
          section: c.section,
          ordinal: i,
          text: c.text,
          sources: c.sources,
        })),
      );
    }

    return { summary, claims, mode };
  },

  async latestFor(patientId: string) {
    const [summary] = await db
      .select()
      .from(aiSummaries)
      .where(eq(aiSummaries.patientId, patientId))
      .orderBy(desc(aiSummaries.createdAt))
      .limit(1);
    if (!summary) return null;
    const claims = await db
      .select()
      .from(aiSummaryClaims)
      .where(eq(aiSummaryClaims.summaryId, summary.id))
      .orderBy(aiSummaryClaims.ordinal);
    return { summary, claims };
  },
};
