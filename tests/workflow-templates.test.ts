import { test } from "node:test";
import assert from "node:assert/strict";
import { newProjectStages } from "../lib/workflow-templates";
test("live branding stages match Alex's supplied folder order plus goodbye packet", () => {
  assert.deepEqual(
    newProjectStages("Brand Identity").map((s) => s.name),
    [
      "Enquiry Stage",
      "Project Proposal",
      "Onboarding",
      "Contract",
      "Invoice",
      "Creative Direction",
      "Logo Design",
      "Logo Presentation",
      "Brand Touchpoints",
      "Brand Guidelines",
      "Goodbye Packet",
    ],
  );
});
test("website workflow is Framer/design focused and contains no branding work", () => {
  const stages = newProjectStages("Website Design");
  assert.equal(stages.length, 11);
  assert.deepEqual(
    stages.slice(5).map((s) => s.name),
    [
      "Website Brief & Content",
      "Page Structure & Layout",
      "Website Design",
      "Framer Build & Review",
      "Launch & Handover",
      "Goodbye Packet",
    ],
  );
  assert.equal(stages.filter((s) => s.stream === "Brand Identity").length, 0);
});
test("combined work has shared acquisition, separate creative streams and one goodbye", () => {
  const stages = newProjectStages("Both");
  assert.equal(stages.length, 16);
  assert.equal(stages.filter((s) => s.stream === "Onboarding").length, 5);
  assert.equal(stages.filter((s) => s.stream === "Brand Identity").length, 5);
  assert.equal(stages.filter((s) => s.stream === "Website Design").length, 5);
  assert.equal(stages.filter((s) => s.name === "Goodbye Packet").length, 1);
  assert.notStrictEqual(newProjectStages("Both"), stages);
});
