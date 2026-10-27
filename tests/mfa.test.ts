import { test } from "node:test";
import assert from "node:assert/strict";
import { requiresMfa, authenticatorQrSource } from "../lib/mfa";
test("verified owner factors require a current high-assurance session", () => {
  assert.equal(requiresMfa("admin", [{ status: "verified" }], "aal1"), true);
  assert.equal(requiresMfa("admin", [{ status: "verified" }], null), true);
  assert.equal(requiresMfa("admin", [{ status: "verified" }], "aal2"), false);
});
test("unverified setup cannot lock out an owner and client accounts retain their own permissions", () => {
  assert.equal(requiresMfa("admin", [{ status: "unverified" }], "aal1"), false);
  assert.equal(requiresMfa("admin", undefined, "aal1"), false);
  assert.equal(requiresMfa("client", [{ status: "verified" }], "aal1"), false);
});

test("provider SVG QR codes retain hash colours and markup when embedded as an image", () => {
  const svg = '<svg><path fill="#000000"/></svg>';
  const source = authenticatorQrSource("data:image/svg+xml;utf-8," + svg);
  assert.equal(decodeURIComponent(source.split(",")[1]), svg);
  assert.ok(!source.includes("#"));
});
