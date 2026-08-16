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
import { join } from "node:path";

export interface StorageAdapter {
  readonly name: string;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

class LocalStorage implements StorageAdapter {
  readonly name = "local";
  private baseDir = ".uploads";

  private path(key: string) {
    return join(this.baseDir, key.replace(/\.\./g, "").replace(/\\/g, "/"));
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
    return {
      Authorization: `Bearer ${this.serviceKey}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
    };
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const res = await fetch(
      `${this.url}/storage/v1/object/${this.bucket}/${encodeURIComponent(key)}`,
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
      `${this.url}/storage/v1/object/${this.bucket}/${encodeURIComponent(key)}`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error(`Supabase storage get failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    await fetch(
      `${this.url}/storage/v1/object/${this.bucket}/${encodeURIComponent(key)}`,
      { method: "DELETE", headers: this.headers() },
    );
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
  return new LocalStorage();
}

export function contentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
