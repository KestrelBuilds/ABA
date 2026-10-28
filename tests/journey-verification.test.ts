import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stageVerification,
  verifiedStageStatus,
} from "../lib/journey-verification";
import type { DbProject, DbStage } from "../lib/workspace";
const project = {
  contract_signed: false,
  deposit_paid: false,
  final_approved: false,
  final_paid: false,
} as DbProject;
const stage = {
  name: "Contract and Deposit",
  stream: "Onboarding",
  status: "Completed",
} as DbStage;
test("contradictory completed contract milestones stay unverified without inventing records", () => {
  assert.equal(verifiedStageStatus(stage, project), "Awaiting verification");
  assert.equal(stage.status, "Completed");
  assert.equal(project.deposit_paid, false);
  assert.equal(
    verifiedStageStatus(stage, { ...project, contract_signed: true }),
    "In Progress",
  );
  assert.equal(
    verifiedStageStatus(stage, {
      ...project,
      contract_signed: true,
      deposit_paid: true,
    }),
    "Completed",
  );
});
test("revoking a verified record restores the journey restriction", () => {
  const verified = { ...project, contract_signed: true, deposit_paid: true };
  assert.equal(verifiedStageStatus(stage, verified), "Completed");
  assert.equal(
    verifiedStageStatus(stage, { ...verified, deposit_paid: false }),
    "In Progress",
  );
});
test("final approval and payment require separate verified records in both workstreams", () => {
  for (const stream of ["Brand Identity", "Website Design"]) {
    const invoice = { ...stage, stream, name: "Final Invoice" };
    const approval = {
      ...stage,
      stream,
      name:
        stream === "Brand Identity"
          ? "Final Review and Approval"
          : "Final Approval",
    };
    assert.equal(
      verifiedStageStatus(invoice, { ...project, final_approved: true }),
      "Awaiting verification",
    );
    assert.equal(
      verifiedStageStatus(approval, { ...project, final_paid: true }),
      "Awaiting verification",
    );
    assert.equal(
      verifiedStageStatus(invoice, { ...project, final_paid: true }),
      "Completed",
    );
    assert.equal(
      verifiedStageStatus(approval, { ...project, final_approved: true }),
      "Completed",
    );
  }
});
test("custom labels and unrelated streams never acquire inferred payment meaning", () => {
  for (const custom of [
    { ...stage, name: "Contract PDF uploaded" },
    { ...stage, stream: "Custom" },
    { ...stage, name: "Deposit sent" },
  ]) {
    assert.deepEqual(stageVerification(custom), []);
    assert.equal(verifiedStageStatus(custom, project), "Completed");
  }
});
