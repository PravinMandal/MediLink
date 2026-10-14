/**
 * Durable worker runner (BuildPlan §9.1, §9.4; Backlog C1).
 *
 * Invoked by the platform scheduler (Vercel Cron / external monitor) hitting
 * /api/worker on an interval. Executes bounded batches of:
 *  1. document extraction jobs (claim-and-run, idempotent),
 *  2. generic job_runs,
 *  3. outbox events (registered handlers),
 *  4. consent expiry + access-request expiry sweeps.
 *
 * CRON_SECRET (when set) must be supplied as a Bearer token. Route handlers
 * give serverless functions their durability story: retries come from the
 * scheduler, state lives in the database, not in a live process.
 */
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  jobs,
  outbox,
  registerOutboxHandler,
  registerJobHandler,
} from "@/server/modules/jobs/outbox";
import { runExtractionPass } from "@/server/modules/documents/pipeline-v2";
import { consent as consentService } from "@/server/modules/consent/service";
import { accessRequestsService } from "@/server/modules/consent/access-requests";

export const dynamic = "force-dynamic";
/**
 * Live outbox handlers: document lifecycle events fan out to patient
 * notifications. Handlers are idempotent (a re-drained event re-runs
 * notify.push, which creates at most a duplicate notification, never
 * clinical state).
 */
function registerHandlers() {
  registerOutboxHandler("document.uploaded", async (payload: Record<string, unknown>) => {
    const { notify } = await import("@/server/modules/notifications/service");
    const { patients } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    const patientId = payload.patientId as string;
    const [p] = await db
      .select({ userId: patients.userId })
      .from(patients)
      .where(eq(patients.id, patientId));
    if (p?.userId) {
      await notify.push({
        userId: p.userId,
        type: "document",
        title: "A document was added to your record",
        body: "It is stored unchanged; extracted fields are machine-read until reviewed.",
        link: "/portal/patient/documents",
      });
    }
  });

  registerOutboxHandler("document.extracted", async () => {
    // extraction completion is visible via the document status chip
  });

  registerOutboxHandler("clinical_version.sealed", async (payload: Record<string, unknown>) => {
    const { notify } = await import("@/server/modules/notifications/service");
    const { patients } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    const patientId = payload.patientId as string;
    const [p] = await db
      .select({ userId: patients.userId })
      .from(patients)
      .where(eq(patients.id, patientId));
    if (p?.userId) {
      await notify.push({
        userId: p.userId,
        type: "record",
        title: "A record was added to your timeline",
        body: "Every sealed entry carries its author and source; open Evidence to verify.",
        link: "/portal/patient/record",
      });
    }
  });

  registerOutboxHandler("clinical_version.corrected", async (payload: Record<string, unknown>) => {
    const { notify } = await import("@/server/modules/notifications/service");
    const { patients } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    const patientId = payload.patientId as string;
    const [p] = await db
      .select({ userId: patients.userId })
      .from(patients)
      .where(eq(patients.id, patientId));
    if (p?.userId) {
      await notify.push({
        userId: p.userId,
        type: "record",
        title: "A record was corrected",
        body: "The original is preserved; view the corrected history on your timeline.",
        link: "/portal/patient/record",
      });
    }
  });

  // Generic job: contradiction re-detection after record writes.
  registerJobHandler("records.contradictions", async (payload: Record<string, unknown>) => {
    const { contradictionEngine } = await import("@/server/modules/ai/contradictions");
    await contradictionEngine.detect(payload.patientId as string);
    return { patientId: payload.patientId };
  });

  // Generic job: durable structured extraction (text → observations/reports).
  // Idempotent per document via the job's idempotency key.
  registerJobHandler(
    "documents.structured_extraction",
    async (payload: Record<string, unknown>) => {
      const { runStructuredExtraction } = await import(
        "@/server/modules/documents/structured-extraction"
      );
      return runStructuredExtraction(payload.documentId as string, {
        patientId: payload.patientId as string,
        userId: payload.userId as string,
        organizationId: (payload.organizationId as string | null) ?? null,
        title: payload.title as string,
        kind: payload.kind as string,
        recordedDate: payload.recordedDate as string | undefined,
      });
    },
  );
}

let handlersRegistered = false;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !secret) {
    // An open worker endpoint would let anyone burn LLM quota and trigger
    // notification fan-out. In production the secret is mandatory.
    console.error("[worker] CRON_SECRET is not configured");
    return NextResponse.json({ error: "worker not configured" }, { status: 503 });
  }
  if (secret) {
    // Vercel Cron cannot send custom Authorization headers, while external
    // schedulers (cron-job.org) can. Accept Bearer (preferred), the
    // x-cron-secret header, or ?cronSecret= as a last resort for schedulers
    // that only support URL configuration. The secret VALUE is never logged;
    // Vercel access logs record that the endpoint was hit.
    const url = new URL(request.url);
    const auth = request.headers.get("authorization");
    const headerSecret = request.headers.get("x-cron-secret");
    const querySecret = url.searchParams.get("cronSecret") ?? url.searchParams.get("secret");
    const ok =
      auth === `Bearer ${secret}` ||
      headerSecret === secret ||
      (querySecret !== null && querySecret === secret);
    if (!ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  if (!handlersRegistered) {
    registerHandlers();
    handlersRegistered = true;
  }

  const summary: {
    extraction: unknown[];
    jobs: unknown[];
    outbox: unknown;
    consentExpiry: unknown;
    accessRequestExpiry: unknown;
  } = {
    extraction: [],
    jobs: [],
    outbox: null,
    consentExpiry: null,
    accessRequestExpiry: "ok",
  };
  let checkpoint: { id: string; lastSeq: number; manifestSha256: string } | null = null;

  // 1. Extraction jobs (bounded batch)
  for (let i = 0; i < 10; i++) {
    const pass = await runExtractionPass();
    if (!pass.ran) break;
    summary.extraction.push(pass);
  }

  // 2. Generic durable jobs (bounded batch)
  for (let i = 0; i < 10; i++) {
    const run = await jobs.runOnce();
    if (!run.ran) break;
    summary.jobs.push(run);
  }

  // 3. Outbox events (indexing/notification handlers)
  summary.outbox = await outbox.drain(50);

  // 4. Sweeps
  try {
    await consentService.expireStale();
    summary.consentExpiry = "ok";
  } catch (err) {
    summary.consentExpiry = String(err).slice(0, 200);
  }
  try {
    await accessRequestsService.expireStale();
  } catch (err) {
    summary.accessRequestExpiry = String(err).slice(0, 200);
  }

  // 5. Audit integrity checkpoint over new chain events since the last one
  //    (§9.6: periodic signed manifests; the manifest hash is the value an
  //    external anchoring job would publish).
  try {
    const { checkpoints } = await import("@/server/modules/audit/checkpoints");
    checkpoint = await checkpoints.create();
  } catch (err) {
    console.error("[worker] checkpoint creation failed", err);
  }

  void db;
  return NextResponse.json({ ok: true, at: new Date().toISOString(), summary, checkpoint });
}
