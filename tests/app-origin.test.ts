import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAppOrigin } from "../lib/app-origin";
test("email redirects use explicit origin or trusted Vercel production hostname", () => {
  assert.equal(
    resolveAppOrigin("https://studio.example.com/", "old.example.com"),
    "https://studio.example.com",
  );
  assert.equal(
    resolveAppOrigin(undefined, "aba.example.com"),
    "https://aba.example.com",
  );
  assert.equal(
    resolveAppOrigin("http://localhost:3000"),
    "http://localhost:3000",
  );
});
test("email redirect configuration rejects missing, insecure, credential-bearing or non-origin destinations", () => {
  for (const origin of [
    "",
    "http://studio.example.com",
    "ftp://localhost",
    "https://user:secret@studio.example.com",
    "https://studio.example.com/login",
    "https://studio.example.com/?redirect=elsewhere",
    "not a url",
  ])
    assert.throws(() => resolveAppOrigin(origin));
});
