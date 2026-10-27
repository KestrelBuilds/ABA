import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSupabaseSettings } from "../lib/supabase/config";
test("accepts Vercel integration anonymous key and server URL", () => {
  assert.deepEqual(
    resolveSupabaseSettings({
      serverUrl: "https://demo.supabase.co",
      anonymousKey: "fictional-anonymous-key",
    }),
    { url: "https://demo.supabase.co", key: "fictional-anonymous-key" },
  );
});
test("prefers explicit public URL and publishable key", () => {
  assert.deepEqual(
    resolveSupabaseSettings({
      publicUrl: "https://current.supabase.co",
      serverUrl: "https://old.supabase.co",
      publishableKey: "fictional-publishable",
      anonymousKey: "fictional-legacy",
    }),
    { url: "https://current.supabase.co", key: "fictional-publishable" },
  );
});
test("missing or blank public credentials keep configuration disabled", () => {
  assert.deepEqual(resolveSupabaseSettings({}), { url: "", key: "" });
  assert.deepEqual(
    resolveSupabaseSettings({
      publishableKey: "  ",
      anonymousKey: "fictional-legacy",
    }),
    { url: "", key: "fictional-legacy" },
  );
});
