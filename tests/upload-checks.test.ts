import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inspectFile } from "../lib/file-inspection";
import { scanFile, validScanner } from "../lib/file-scanner";
import { uploadMime, fileAvailable } from "../lib/upload-policy";
test("source upload inspection checks real signatures and rejects spoofed types, unsafe archives and expansion bombs", async () => {
  assert.equal(
    await inspectFile(Buffer.from("%PDF-1.7 fictional"), "Proof.pdf"),
    "application/pdf",
  );
  assert.equal(
    await inspectFile(Buffer.from("%!PS-Adobe fictional"), "Source.ai"),
    "application/postscript",
  );
  await assert.rejects(
    () => inspectFile(Buffer.from("MZbad executable"), "Proof.pdf"),
    /contents/,
  );
  await assert.rejects(
    () => inspectFile(Buffer.from("x"), "Bad.zip"),
    /contents/,
  );
  assert.throws(() => uploadMime("../proof.pdf"));
  assert.throws(() => uploadMime("script.js"));
  const fixtures = JSON.parse(
    await readFile("tests/fixtures/upload-zips.json", "utf8"),
  );
  assert.equal(
    await inspectFile(Buffer.from(fixtures.safe, "base64"), "Source.zip"),
    "application/zip",
  );
  for (const key of [
    "traversal",
    "nested",
    "script",
    "bomb",
    "disguised",
    "symlink",
  ])
    await assert.rejects(
      () => inspectFile(Buffer.from(fixtures[key], "base64"), "Source.zip"),
      key,
    );
  assert.equal(fileAvailable({ scan_state: "pending" }), false);
  assert.equal(fileAvailable({ scan_state: "rejected" }), false);
  assert.equal(fileAvailable({ scan_state: "legacy" }), true);
});
test("scanner adapter requires a secure configured endpoint and matching digest verdict; outages never release quarantine", async () => {
  const config = {
      url: "https://scanner.example.test/check",
      key: "fictional-test-key",
    },
    hash = "d".repeat(64),
    bytes = Buffer.from("%PDF-test");
  assert.equal(validScanner(config), true);
  assert.equal(
    validScanner({ ...config, url: "http://scanner.example.test/check" }),
    false,
  );
  assert.equal(
    validScanner({ ...config, url: "https://user:pass@scanner.example.test" }),
    false,
  );
  assert.equal(
    validScanner({
      ...config,
      url: "http://127.0.0.1/check",
      allowLocal: true,
    }),
    true,
  );
  const fetcher = (status: string, digest = hash, code = 200) =>
    (async (url, init) => {
      assert.equal(url, config.url);
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer fictional-test-key",
      );
      assert.deepEqual(Buffer.from(init?.body as ArrayBuffer), bytes);
      return new Response(JSON.stringify({ status, sha256: digest }), {
        status: code,
      });
    }) as typeof fetch;
  assert.equal(
    await scanFile(
      bytes,
      "Proof.pdf",
      "application/pdf",
      hash,
      config,
      fetcher("clean"),
    ),
    "clean",
  );
  assert.equal(
    await scanFile(
      bytes,
      "Proof.pdf",
      "application/pdf",
      hash,
      config,
      fetcher("infected"),
    ),
    "rejected",
  );
  await assert.rejects(
    () =>
      scanFile(
        bytes,
        "Proof.pdf",
        "application/pdf",
        hash,
        config,
        fetcher("clean", "e".repeat(64)),
      ),
    /matching/,
  );
  await assert.rejects(
    () =>
      scanFile(
        bytes,
        "Proof.pdf",
        "application/pdf",
        hash,
        config,
        fetcher("unknown"),
      ),
    /matching/,
  );
  await assert.rejects(
    () =>
      scanFile(
        bytes,
        "Proof.pdf",
        "application/pdf",
        hash,
        config,
        fetcher("clean", hash, 503),
      ),
    /unavailable/,
  );
});
