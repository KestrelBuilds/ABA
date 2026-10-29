import { test } from "node:test";
import assert from "node:assert/strict";
import { projectFocus } from "../lib/project-focus";
import type { DbProject, DbStage, WorkspaceData } from "../lib/workspace";
const project = {
  id: "p",
  contract_signed: false,
  deposit_paid: false,
  final_approved: false,
  final_paid: false,
} as DbProject;
const stage = {
  id: "s",
  project_id: "p",
  name: "Contract and Deposit",
  stream: "Onboarding",
  position: 1,
  status: "Completed",
} as DbStage;
function data(stages: DbStage[] = [stage], invoices: unknown[] = []) {
  return { stages, finance: { invoices } } as unknown as WorkspaceData;
}
test("next step uses verified status, scope and order rather than stale completed records", () => {
  const summary = projectFocus(
    data([{ ...stage, id: "other", project_id: "other", position: 0 }, stage]),
    project,
  );
  assert.equal(summary.next?.id, "s");
  assert.equal(summary.next?.status, "Awaiting verification");
  assert.deepEqual(summary.portalMissing, [
    "signed contract",
    "deposit payment",
  ]);
  assert.deepEqual(summary.deliveryMissing, [
    "signed contract",
    "deposit payment",
    "final creative approval",
    "final payment",
  ]);
  assert.equal(summary.nextHref, "#stage-s");
});
test("native payments route to invoice actions after contract verification; void invoices do not", () => {
  const native = data(
    [stage],
    [{ project_id: "p", kind: "Deposit", status: "Issued" }],
  );
  assert.equal(projectFocus(native, project).nextHref, "#stage-s");
  assert.equal(
    projectFocus(native, { ...project, contract_signed: true }).nextHref,
    "#existing-invoices",
  );
  assert.equal(
    projectFocus(data([stage], [{ project_id: "p", status: "Void" }]), {
      ...project,
      contract_signed: true,
    }).nextHref,
    "#stage-s",
  );
});
test("milestone completion does not imply delivery eligibility, and custom work retains its status", () => {
  const custom = { ...stage, name: "Custom review", status: "Completed" };
  const result = projectFocus(data([custom]), {
    ...project,
    contract_signed: true,
    deposit_paid: true,
  });
  assert.equal(result.next, undefined);
  assert.deepEqual(result.portalMissing, []);
  assert.deepEqual(result.deliveryMissing, [
    "final creative approval",
    "final payment",
  ]);
  assert.match(result.nextLabel, /review delivery eligibility/);
});
test("empty workflows and completed verified workflows have useful next steps", () => {
  assert.equal(
    projectFocus(data([]), project).nextLabel,
    "Add your first milestone",
  );
  assert.deepEqual(
    projectFocus(data(), {
      ...project,
      contract_signed: true,
      deposit_paid: true,
      final_approved: true,
      final_paid: true,
    }).deliveryMissing,
    [],
  );
  const reordered = projectFocus(
    data([
      { ...stage, position: 10 },
      {
        ...stage,
        id: "first",
        name: "Enquiry",
        position: 0,
        status: "In Progress",
      },
    ]),
    project,
  );
  assert.equal(reordered.next?.id, "first");
});

test("project focus separates an enabled early area, account connection and full journey gates", () => {
  const currentProject = { ...project, client_id: "c" };
  const base = {
    ...data(),
    projects: [currentProject],
    clients: [],
    documents: [],
    portalStatuses: [{ client_id: "c", state: "connected", eligible: true }],
    prospectSpaces: [
      {
        project_id: "p",
        enabled: true,
        enquiry_status: "new",
        release_step: "discovery",
      },
    ],
  } as unknown as WorkspaceData;
  assert.equal(projectFocus(base, currentProject).earlyArea, "discovery");
  assert.equal(
    projectFocus(base, currentProject).portalStatus?.state,
    "connected",
  );
  assert.equal(projectFocus(base, currentProject).portalMissing.length, 2);
  base.prospectSpaces![0].enabled = false;
  assert.equal(projectFocus(base, currentProject).earlyArea, null);
  base.prospectSpaces![0].enabled = true;
  base.prospectSpaces![0].enquiry_status = "closed";
  assert.equal(projectFocus(base, currentProject).earlyArea, null);
  base.prospectSpaces![0].enquiry_status = "new";
  base.clients = [
    {
      id: "c",
      name: "Client",
      contact: "Jamie",
      email: "client@example.com",
      sector: "Design",
      deletion_pending: true,
    },
  ];
  assert.equal(projectFocus(base, currentProject).deletionPending, true);
  assert.equal(projectFocus(base, currentProject).earlyArea, null);
});
