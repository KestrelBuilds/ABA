import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingUrl, discoveryBookingUrl } from "../lib/stage-links";
import { stageGuidance } from "../lib/stage-copy";
test("Calendly links are HTTPS public pages with no credentials or lookalike hosts", () => {
  assert.equal(bookingUrl(discoveryBookingUrl), discoveryBookingUrl);
  assert.equal(bookingUrl(""), "");
  for (const url of [
    "javascript:alert(1)",
    "https://calendly.com.evil.test/alex",
    "http://calendly.com/alex",
    "https://user:pass@calendly.com/alex",
  ])
    assert.throws(() => bookingUrl(url));
});
test("stage guidance supports original externally-made PDFs and recorded verification", () => {
  assert.match(stageGuidance("Project Proposal"), /PDF/);
  assert.match(stageGuidance("Contract and Deposit"), /verify/);
  assert.match(stageGuidance("Final Invoice"), /does not confirm payment/);
});
