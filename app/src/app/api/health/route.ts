import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

/**
 * Liveness + database probe. Used by external keep-alive (cron-job.org)
 * so Supabase free tier never hits the 7-day inactivity pause, and by
 * uptime monitors. Intentionally unauthenticated: runs SELECT 1 only.
 */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true, db: "up", t: Date.now() });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
