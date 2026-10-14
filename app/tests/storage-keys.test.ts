/**
 * Storage key encoding regression tests.
 *
 * Context: SupabaseStorage used encodeURIComponent() on the WHOLE
 * "<patientId>/<docId>" key, turning the separator into %2F. Object
 * endpoints decode that back for storage, but the sign endpoint binds the
 * encoded path into the token — every signed-URL fetch then failed with
 * `InvalidSignature`, breaking all document previews/downloads on
 * Supabase-backed deploys. encodeKey() must encode segments separately and
 * preserve the separator.
 */
import { describe, expect, it } from "vitest";
import { assertValidKey, encodeKey } from "../src/server/modules/documents/storage";

const KEY = "a5a28746-cfc5-443d-afc5-9638043cccfa/a2dae1ff-afb3-4198-ba0b-3b4146c345c7";

describe("storage keys", () => {
  it("accepts well-formed patient/document keys", () => {
    expect(assertValidKey(KEY)).toBe(KEY);
  });

  it("rejects traversal and malformed keys", () => {
    for (const bad of [
      "../etc/passwd",
      "a5a28746-cfc5-443d-afc5-9638043cccfa/../../x",
      "not-a-key",
      "",
      KEY + "/extra",
    ]) {
      expect(() => assertValidKey(bad)).toThrow();
    }
  });

  it("preserves the / separator when encoding for Supabase paths", () => {
    const enc = encodeKey(KEY);
    expect(enc).toBe(KEY); // UUIDs need no escaping; the slash must survive
    expect(enc).not.toContain("%2F");
    expect(enc.split("/")).toHaveLength(2);
  });
});
