import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  storageWasDenied,
  assertStorageDenied,
  fictionalPdf,
  assertStoredBytes,
  assertSignedDownload,
} from "../lib/supabase/storage-check";
const client = (api: object) =>
  ({ storage: { from: () => api } }) as unknown as SupabaseClient;
test("a failed network request never counts as successful file isolation", async () => {
  assert.equal(storageWasDenied({ status: 403 }), true);
  assert.equal(storageWasDenied({ status: 400, statusCode: "404" }), true);
  for (const e of [
    null,
    new Error("Network down"),
    { status: 500 },
    { statusCode: "503" },
  ])
    assert.equal(storageWasDenied(e), false);
  await assert.rejects(
    () =>
      assertStorageDenied(
        client({
          download: async () => ({
            data: null,
            error: new Error("Network down"),
          }),
        }),
        "project/doc",
        "Privacy",
      ),
    /did not pass/,
  );
  await assertStorageDenied(
    client({
      download: async () => ({ data: null, error: { status: 404 } }),
      createSignedUrl: async () => ({ data: null, error: { status: 403 } }),
    }),
    "project/doc",
    "Privacy",
  );
});
test("private downloads verify bytes rather than only a successful HTTP status", async () => {
  const pdf = fictionalPdf();
  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.ok(pdf.endsWith("%%EOF\n"));
  await assertStoredBytes(
    client({ download: async () => ({ data: new Blob([pdf]), error: null }) }),
    "project/doc",
    pdf,
  );
  await assert.rejects(
    () =>
      assertStoredBytes(
        client({
          download: async () => ({
            data: new Blob(["wrong data"]),
            error: null,
          }),
        }),
        "project/doc",
        pdf,
      ),
    /content verification/,
  );
});
test("signed download checks refuse a different host and wrong response body", async () => {
  const pdf = fictionalPdf();
  let fetched = false;
  const evil = client({
    createSignedUrl: async () => ({
      data: { signedUrl: "https://unexpected.example.com/object" },
      error: null,
    }),
  });
  const fetchFile = (async () => {
    fetched = true;
    return new Response(pdf);
  }) as typeof fetch;
  await assert.rejects(
    () =>
      assertSignedDownload(
        evil,
        "project/doc",
        pdf,
        "https://storage.example.com",
        fetchFile,
      ),
    /unexpected destination/,
  );
  assert.equal(fetched, false);
  const good = client({
    createSignedUrl: async () => ({
      data: { signedUrl: "https://storage.example.com/object?token=fictional" },
      error: null,
    }),
  });
  await assertSignedDownload(
    good,
    "project/doc",
    pdf,
    "https://storage.example.com",
    fetchFile,
  );
  assert.equal(fetched, true);
  await assert.rejects(
    () =>
      assertSignedDownload(
        good,
        "project/doc",
        pdf,
        "https://storage.example.com",
        (async () => new Response("bad bytes")) as typeof fetch,
      ),
    /content verification/,
  );
});
