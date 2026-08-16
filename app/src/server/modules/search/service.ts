/**
 * Search — patient-scoped full-text search over indexed record chunks.
 *
 * SECURITY INVARIANT: every query filters by patientId inside SQL. The
 * retrieval path used by the AI module goes through the same function, so
 * cross-patient retrieval is structurally impossible here.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { searchChunks } from "@/server/db/schema";

export type SearchHit = {
  chunkId: string;
  recordType: string;
  recordId: string;
  documentId: string | null;
  label: string;
  date: string | null;
  trust: string | null;
  snippet: string;
  rank: number;
};

function snippetFor(content: string, terms: string[], width = 160): string {
  const lower = content.toLowerCase();
  let idx = -1;
  for (const t of terms) {
    const i = lower.indexOf(t.toLowerCase());
    if (i >= 0) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return content.slice(0, width);
  const start = Math.max(0, idx - 40);
  return (start > 0 ? "…" : "") + content.slice(start, start + width);
}

export const search = {
  /** Full-text search within ONE patient's authorized record space. */
  async inPatient(
    patientId: string,
    query: string,
    limit = 20,
  ): Promise<SearchHit[]> {
    const q = query.trim();
    if (!q) return [];
    const rows = await db
      .select({
        chunkId: searchChunks.id,
        recordType: searchChunks.recordType,
        recordId: searchChunks.recordId,
        documentId: searchChunks.documentId,
        label: searchChunks.label,
        date: searchChunks.date,
        trust: searchChunks.trust,
        content: searchChunks.content,
        rank: sql<number>`ts_rank(
          to_tsvector('english', ${searchChunks.content}),
          websearch_to_tsquery('english', ${q})
        )`,
      })
      .from(searchChunks)
      .where(
        and(
          eq(searchChunks.patientId, patientId),
          sql`to_tsvector('english', ${searchChunks.content}) @@ websearch_to_tsquery('english', ${q})`,
        ),
      )
      .orderBy(sql`rank DESC`)
      .limit(limit);

    const terms = q.split(/\s+/).filter(Boolean);
    return rows.map((r) => ({
      chunkId: r.chunkId,
      recordType: r.recordType,
      recordId: r.recordId,
      documentId: r.documentId,
      label: r.label,
      date: r.date,
      trust: r.trust,
      snippet: snippetFor(r.content, terms),
      rank: Number(r.rank),
    }));
  },
};
