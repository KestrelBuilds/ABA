import { test } from "node:test";
import assert from "node:assert/strict";
import type { WorkspaceData } from "../lib/workspace";
import { workspaceAttention } from "../lib/workspace-attention";
const project = {
  id: "p",
  client_id: "c",
  name: "Test brand",
  type: "Brand Identity",
  contract_signed: false,
  deposit_paid: false,
  final_paid: false,
  final_approved: false,
};
function fixture() {
  return {
    role: "admin",
    clients: [{ id: "c", name: "One", email: "one@example.com" }],
    projects: [project],
    stages: [
      {
        id: "s",
        project_id: "p",
        name: "Contract",
        stream: "Onboarding",
        visible: true,
      },
    ],
    documents: [
      {
        id: "contract",
        project_id: "p",
        stage_id: "s",
        document_role: "Contract",
        category: "document",
        published: true,
      },
    ],
    assets: [{ id: "a", project_id: "p", contract_document_id: "contract" }],
    clientActions: [
      { id: "task", project_id: "p", due: "2026-10-28", status: "To do" },
    ],
    enquiries: [{ id: "e", status: "new" }],
    portalStatuses: [{ client_id: "c", state: "not_invited", eligible: true }],
    prospectSpaces: [
      {
        project_id: "p",
        release_step: "proposal",
        enabled: true,
        enquiry_status: "proposal",
      },
    ],
    proposalResponses: [{ project_id: "p", document_id: "proposal" }],
  } as unknown as WorkspaceData;
}
test("attention derives actionable owner records and links to their real project/client sections without mutations", () => {
  const data = fixture(),
    before = JSON.stringify(data);
  const items = workspaceAttention(data, "2026-10-29");
  assert.deepEqual(
    items.map((i) => i.id),
    ["enquiries", "contract-p", "proposal-p", "actions-p", "invite-c"],
  );
  assert.deepEqual(items[1].destination, {
    area: "project",
    projectId: "p",
    href: "#stage-s",
  });
  assert.deepEqual(items[4].destination, { area: "client", clientId: "c" });
  assert.equal(JSON.stringify(data), before);
  // Routine asset uploads are not signed-contract verification evidence.
  data.assets![0].contract_document_id = null;
  assert.equal(
    workspaceAttention(data, "2026-10-29").some((i) => i.id === "contract-p"),
    false,
  );
});
test("attention hides client data projections, completed/closed/deleting records and deliberately revoked access", () => {
  const data = fixture();
  assert.deepEqual(
    workspaceAttention({ ...data, role: "client" }, "2026-10-29"),
    [],
  );
  data.projects[0] = { ...data.projects[0], contract_signed: true };
  data.clientActions![0].status = "Done";
  data.prospectSpaces![0].enquiry_status = "considering";
  data.prospectSpaces![0].release_step = "agreement";
  data.portalStatuses![0].state = "revoked";
  assert.deepEqual(
    workspaceAttention(data, "2026-10-29").map((i) => i.id),
    ["enquiries"],
  );
  data.prospectSpaces![0].enquiry_status = "closed";
  data.projects[0].contract_signed = false;
  assert.deepEqual(
    workspaceAttention(data, "2026-10-29").map((i) => i.id),
    ["enquiries"],
  );
  data.clients[0].deletion_pending = true;
  data.prospectSpaces![0].enquiry_status = "proposal";
  assert.deepEqual(
    workspaceAttention(data, "2026-10-29").map((i) => i.id),
    ["enquiries"],
  );
});
test("ready final checks do not imply files are shared; hidden/draft files still need owner review", () => {
  const data = fixture();
  data.enquiries = [];
  data.assets = [];
  data.clientActions = [];
  data.proposalResponses = [];
  data.portalStatuses = [];
  data.projects[0] = {
    ...data.projects[0],
    contract_signed: true,
    deposit_paid: true,
    final_paid: true,
    final_approved: true,
  };
  data.documents = [
    {
      id: "final",
      project_id: "p",
      stage_id: "s",
      category: "final",
      published: false,
      name: "Final.pdf",
    },
  ];
  assert.equal(workspaceAttention(data, "2026-10-29")[0]?.id, "delivery-p");
  data.documents[0].published = true;
  assert.deepEqual(workspaceAttention(data, "2026-10-29"), []);
  data.stages[0].visible = false;
  assert.equal(workspaceAttention(data, "2026-10-29")[0]?.id, "delivery-p");
  data.projects[0].final_paid = false;
  assert.deepEqual(workspaceAttention(data, "2026-10-29"), []);
});
