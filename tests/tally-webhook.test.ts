import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyTallySignature, tallyEnquiry } from "../lib/tally-webhook";
import { POST } from "../app/api/tally/route";
const secret = "fictional-test-signing-secret";
const event = {
  eventId: "event-1",
  eventType: "FORM_RESPONSE",
  data: {
    formId: "mOLMrk",
    responseId: "response-1",
    fields: [
      {
        key: "email",
        label: "Email",
        type: "INPUT_EMAIL",
        value: "test@example.com",
      },
      { key: "name", label: "Your name", type: "INPUT_TEXT", value: "Jamie" },
      {
        key: "business",
        label: "Business name",
        type: "INPUT_TEXT",
        value: "Test business",
      },
      {
        key: "file",
        label: "Upload",
        type: "FILE_UPLOAD",
        value: [{ url: "http://private.example/secret" }],
      },
    ],
  },
};
const sign = (raw: string) =>
  createHmac("sha256", secret).update(raw).digest("base64");
test("Tally signatures bind the exact body, and only expected form/allowed plaintext fields are retained", () => {
  const raw = JSON.stringify(event);
  assert.equal(verifyTallySignature(raw, sign(raw), secret), true);
  assert.equal(verifyTallySignature(raw + " ", sign(raw), secret), false);
  assert.equal(verifyTallySignature(raw, "bad", secret), false);
  assert.equal(verifyTallySignature(raw, sign(raw), "wrong"), false);
  const e = tallyEnquiry(raw, "mOLMrk");
  assert.equal(e.email, "test@example.com");
  assert.equal(e.business_name, "Test business");
  assert.equal(e.contact_name, "Jamie");
  assert.equal(e.fields.length, 3);
  assert.equal(JSON.stringify(e).includes("private.example"), false);
  assert.throws(() => tallyEnquiry(raw, "another-form"));
});
test("webhook rejects unsigned/wrong-form/oversized input without writes and stores valid events with duplicate protection", async () => {
  const names = [
    "TALLY_WEBHOOK_SIGNING_SECRET",
    "TALLY_FORM_ID",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
  ] as const;
  const saved = names.map((n) => process.env[n]);
  const original = globalThis.fetch;
  let writes = 0,
    fail = false;
  try {
    Object.assign(process.env, {
      TALLY_WEBHOOK_SIGNING_SECRET: secret,
      TALLY_FORM_ID: "mOLMrk",
      SUPABASE_SERVICE_ROLE_KEY: "fictional-service-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://fictional.supabase.co",
    });
    globalThis.fetch = (async (input: any, init: any) => {
      assert.ok(String(input).includes("/rest/v1/rpc/ingest_tally_enquiry"));
      const payload = JSON.parse(init.body).payload;
      assert.equal(payload.source, "tally");
      assert.equal(payload.fields.length, 3);
      writes++;
      return fail
        ? Response.json({ message: "Unavailable" }, { status: 503 })
        : new Response(null, { status: 201 });
    }) as typeof fetch;
    const req = (raw: string, sig: string | null) =>
      new Request("https://example.com/api/tally", {
        method: "POST",
        headers: sig ? { "tally-signature": sig } : {},
        body: raw,
      });
    const raw = JSON.stringify(event);
    assert.equal((await POST(req(raw, null))).status, 401);
    const wrong = JSON.stringify({
      ...event,
      data: { ...event.data, formId: "wrong" },
    });
    assert.equal((await POST(req(wrong, sign(wrong)))).status, 400);
    assert.equal((await POST(req("x".repeat(65537), "bad"))).status, 413);
    assert.equal(writes, 0);
    assert.equal((await POST(req(raw, sign(raw)))).status, 200);
    assert.equal(writes, 1);
    fail = true;
    assert.equal((await POST(req(raw, sign(raw)))).status, 503);
    delete process.env.TALLY_WEBHOOK_SIGNING_SECRET;
    assert.equal((await POST(req(raw, sign(raw)))).status, 503);
  } finally {
    globalThis.fetch = original;
    names.forEach((n, i) => {
      if (saved[i] === undefined) delete process.env[n];
      else process.env[n] = saved[i];
    });
  }
});
