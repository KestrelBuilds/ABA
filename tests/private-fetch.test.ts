import { test } from "node:test";
import assert from "node:assert/strict";
import {
  privateRequestOptions,
  privateFetch,
} from "../lib/supabase/private-fetch";
test("permission-sensitive transport always prevents HTTP caching and supplies a memoization opt-out signal", () => {
  const first = privateRequestOptions(),
    second = privateRequestOptions();
  assert.equal(first.cache, "no-store");
  assert.ok(first.signal instanceof AbortSignal);
  assert.notEqual(first.signal, second.signal);
  const cancellation = new AbortController();
  const init = privateRequestOptions({
    method: "GET",
    cache: "force-cache",
    headers: { Authorization: "Bearer fictional-client-token" },
    signal: cancellation.signal,
  });
  assert.equal(init.cache, "no-store");
  assert.equal(init.signal, cancellation.signal);
  assert.deepEqual(init.headers, {
    Authorization: "Bearer fictional-client-token",
  });
});
test("repeated storage transport reads observe a permission change rather than reuse a cached body", async () => {
  const original = globalThis.fetch;
  let allowed = true,
    networkReads = 0;
  const cached = new Response("cached file");
  globalThis.fetch = (async (_input, init) => {
    if (init?.cache !== "no-store" || !init.signal) return cached.clone();
    networkReads++;
    return allowed
      ? new Response("file bytes")
      : new Response("Denied", { status: 403 });
  }) as typeof fetch;
  try {
    assert.equal(
      (await privateFetch("https://storage.example.com/object")).status,
      200,
    );
    allowed = false;
    assert.equal(
      (await privateFetch("https://storage.example.com/object")).status,
      403,
    );
    assert.equal(networkReads, 2);
  } finally {
    globalThis.fetch = original;
  }
});
