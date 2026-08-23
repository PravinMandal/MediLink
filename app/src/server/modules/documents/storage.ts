/**
 * Document storage adapter.
 *
 * - Local (default): files under .uploads/<patientId>/<docId>, bytes never in
 *   the database.
 * - Supabase (production): private bucket, service-role writes, presigned
 *   reads. Activated by SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

export interface StorageAdapter {
  readonly name: string;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  /** Short-lived signed read URL; null when unsupported (local disk). */
  signedUrl?(key: string, expiresInSeconds?: number): Promise<string | null>;
}

/**
 * Storage keys are always "<patientId>/<docId>" UUIDs. Structural validation
 * plus a resolved-path prefix check — string scrubbing alone is bypassable.
 */
const KEY_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertValidKey(key: string): string {
  if (!KEY_SHAPE.test(key)) throw new Error("Invalid storage key");
  return key;
}

class LocalStorage implements StorageAdapter {
  readonly name = "local";
  private baseDir = ".uploads";

  private path(key: string): string {
    assertValidKey(key);
    const resolved = resolve(join(this.baseDir, key));
    // Defense in depth: the resolved path must stay inside the base dir.
    const base = resolve(this.baseDir);
    if (resolved !== base && !resolved.startsWith(base + sep)) {
      throw new Error("Storage path escapes base directory");
    }
    return resolved;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const p = this.path(key);
    const { dirname } = await import("node:path");
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, bytes);
  }

  async get(key: string): Promise<Uint8Array> {
    const buf = await readFile(this.path(key));
    return new Uint8Array(buf);
  }

  async delete(key: string): Promise<void> {
    const { unlink } = await import("node:fs/promises");
    await unlink(this.path(key)).catch(() => undefined);
  }
}

class SupabaseStorage implements StorageAdapter {
  readonly name = "supabase";
  constructor(
    private url: string,
    private serviceKey: string,
    private bucket: string,
  ) {}

  private headers(json = false) {
    // New sb_secret_ keys are not JWTs; the Storage API requires the raw
    // key in `apikey` alongside the Bearer token or it rejects with
    // "Invalid Compact JWS".
    return {
      Authorization: `Bearer ${this.serviceKey}`,
      apikey: this.serviceKey,
      ...(json ? { "Content-Type": "application/json" } : {}),
    };
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const res = await fetch(
      `${this.url}/storage/v1/object/${this.bucket}/${encodeURIComponent(assertValidKey(key))}`,
      {
        method: "POST",
        headers: { ...this.headers(), "Content-Type": contentType },
        body: bytes as unknown as BodyInit,
      },
    );
    if (!res.ok) {
      throw new Error(`Supabase storage put failed: ${res.status} ${await res.text()}`);
    }
  }

  async get(key: string): Promise<Uint8Array> {
    const res = await fetch(
      `${this.url}/storage/v1/object/${this.bucket}/${encodeURIComponent(assertValidKey(key))}`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error(`Supabase storage get failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    await fetch(
      `${this.url}/storage/v1/object/${this.bucket}/${encodeURIComponent(assertValidKey(key))}`,
      { method: "DELETE", headers: this.headers() },
    );
  }

  /** Signed URL via the Storage Auth API (valid 5 minutes by default). */
  async signedUrl(key: string, expiresInSeconds = 300): Promise<string | null> {
    const res = await fetch(
      `${this.url}/storage/v1/object/sign/${this.bucket}/${encodeURIComponent(assertValidKey(key))}`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const signed = data.signedURL ?? data.signedUrl;
    return signed ? `${this.url}/storage/v1${signed}` : null;
  }
}

export function getStorage(): StorageAdapter {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) {
    return new SupabaseStorage(
      url,
      key,
      process.env.SUPABASE_STORAGE_BUCKET?.trim() || "medical-documents",
    );
  }
  // Local disk is development-only: Vercel's filesystem is read-only/ephemeral.
  // Fail loudly at first use in production instead of silently losing files.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production " +
        "(local disk storage is unavailable on serverless hosting).",
    );
  }
  return new LocalStorage();
}

export function contentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
