import { test } from "node:test";
import assert from "node:assert/strict";
import { clientPreview } from "../lib/client-preview";
import type { WorkspaceData } from "../lib/workspace";
function fixture() {
  return {
    role: "admin",
    emailInvitesReady: true,
    clients: [{ id: "c1" }, { id: "c2" }],
    projects: [
      {
        id: "p1",
        client_id: "c1",
        contract_signed: true,
        deposit_paid: true,
        final_paid: false,
        final_approved: false,
      },
      { id: "p2", client_id: "c2" },
    ],
    stages: [
      { project_id: "p1", visible: true },
      { project_id: "p1", visible: false },
      { project_id: "p2", visible: true },
    ],
    documents: [
      { id: "d1", project_id: "p1", published: true, category: "presentation" },
      { id: "d2", project_id: "p1", published: false, category: "document" },
      { id: "d3", project_id: "p1", published: true, category: "final" },
    ],
    feedback: [{ document_id: "d1" }, { document_id: "d2" }],
    questionnaires: [{ project_id: "p1" }, { project_id: "p2" }],
    notes: [{ body: "Internal only" }],
    audit: [{ action: "Internal action" }],
  } as unknown as WorkspaceData;
}
test("owner preview projects the selected client only and removes internal and unreleased data", () => {
  const p = clientPreview(fixture(), "p1");
  assert.equal(p.role, "client");
  assert.equal(p.clients.length, 1);
  assert.equal(p.projects.length, 1);
  assert.equal(p.stages.length, 1);
  assert.equal(p.documents.length, 1);
  assert.equal(p.feedback.length, 1);
  assert.equal(p.questionnaires.length, 1);
  assert.deepEqual(p.notes, []);
  assert.deepEqual(p.audit, []);
  assert.equal(p.emailInvitesReady, false);
});
test("preview respects onboarding and final-payment/approval gates", () => {
  const data = fixture();
  data.projects[0].deposit_paid = false;
  assert.equal(clientPreview(data, "p1").projects.length, 0);
  data.projects[0].deposit_paid = true;
  data.projects[0].final_paid = true;
  assert.equal(clientPreview(data, "p1").documents.length, 1);
  data.projects[0].final_approved = true;
  assert.equal(clientPreview(data, "p1").documents.length, 2);
});

test("an owner may inspect the planned layout without granting access or revealing locked files", () => {
  const data = fixture();
  data.projects[0].deposit_paid = false;
  const preview = clientPreview(data, "p1", true);
  assert.equal(preview.projects.length, 1);
  assert.equal(preview.projects[0].deposit_paid, false);
  assert.equal(preview.documents.length, 0);
  assert.deepEqual(preview.notes, []);
  assert.equal(data.projects[0].deposit_paid, false);
});
