import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStages,
  acquisition,
  brand,
  website,
  progress,
  seedProjects,
  portalAvailable,
  deliveryAvailable,
  clientStages,
} from "../lib/projects";
test("website workflow excludes branding and has all expected stages", () => {
  const s = createStages("Website Design");
  assert.equal(s.length, acquisition.length + website.length);
  assert.ok(s.every((x) => x.stream !== "Brand Identity"));
  assert.equal(progress(s), 0);
});
test("combined workflow has shared onboarding and independent creative workstreams", () => {
  const s = createStages("Both");
  assert.equal(s.length, acquisition.length + brand.length + website.length);
  assert.equal(new Set(s.map((x) => x.id)).size, s.length);
  assert.equal(s.filter((x) => x.name === "Enquiry").length, 1);
});
test("progress uses completed milestones and handles empty workflows", () => {
  const s = createStages("Brand Identity");
  assert.equal(progress(s.map((x) => ({ ...x, status: "Completed" }))), 100);
  assert.equal(progress([]), 0);
});
test("onboarding requires contract and deposit; delivery requires final payment and approval", () => {
  const p = seedProjects()[0];
  assert.equal(portalAvailable(p), true);
  assert.equal(portalAvailable({ ...p, deposit: false }), false);
  assert.equal(portalAvailable({ ...p, contract: false }), false);
  assert.equal(deliveryAvailable(p), false);
  assert.equal(deliveryAvailable({ ...p, finalPaid: true }), false);
  assert.equal(
    deliveryAvailable({
      ...p,
      finalPaid: true,
      stages: p.stages.map((s) => ({ ...s, status: "Completed" })),
    }),
    true,
  );
});
test("client preview omits internal milestones", () => {
  const p = seedProjects()[0];
  p.stages[0].visible = false;
  assert.equal(clientStages(p).length, p.stages.length - 1);
});
