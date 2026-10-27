import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectInput,
  clientInput,
  feedbackInput,
  questionnaireInput,
  validateFile,
} from "../lib/validation";
test("server input validation rejects invalid budgets, dates, blank names and forged identifiers", () => {
  const p = {
    name: "Fictional project",
    clientId: "10000000-0000-4000-8000-000000000001",
    type: "Both",
    due: "2027-01-01",
    budget: "3200",
  };
  assert.equal(projectInput.parse(p).budget, 3200);
  for (const bad of [
    { budget: -1 },
    { due: "2027-02-31" },
    { name: " " },
    { clientId: "other-client" },
  ])
    assert.equal(projectInput.safeParse({ ...p, ...bad }).success, false);
  assert.equal(
    clientInput.safeParse({
      name: "Demo",
      contact: "Test",
      email: "not-email",
      sector: "",
    }).success,
    false,
  );
  assert.equal(
    feedbackInput.safeParse({
      documentId: p.clientId,
      body: " ",
      decision: "approved",
    }).success,
    false,
  );
  assert.equal(
    questionnaireInput.safeParse({
      projectId: p.clientId,
      kind: "brand",
      answers: {},
    }).success,
    false,
  );
});
test("file uploads restrict size and active document types", () => {
  assert.throws(() =>
    validateFile(new File(["<script/>"], "evil.html", { type: "text/html" })),
  );
  assert.throws(() =>
    validateFile(new File([], "empty.pdf", { type: "application/pdf" })),
  );
  assert.doesNotThrow(() =>
    validateFile(
      new File(["fictional PDF"], "brief.pdf", { type: "application/pdf" }),
    ),
  );
});
