import { test } from "node:test";
import assert from "node:assert/strict";
import {
  previewProspect,
  clientRelationship,
  type ProspectSpace,
} from "../lib/prospects";
import type { WorkspaceData, DbProject, DbStage } from "../lib/workspace";
test("prospective preview releases only selected published roles and never includes a full journey or owner data", () => {
  const p = {
    id: "p",
    client_id: "c",
    name: "Enquiry",
    contract_signed: false,
    deposit_paid: false,
  } as DbProject;
  const space = {
    project_id: "p",
    enabled: true,
    release_step: "discovery",
    enquiry_status: "new",
    booking_url: "https://calendly.com/alex-bell-arts/new-meeting",
    proposal_stage_id: "s",
    contract_stage_id: "s",
    invoice_stage_id: "s",
  } as ProspectSpace;
  const data = {
    projects: [p],
    stages: [{ id: "s", project_id: "p", visible: true } as DbStage],
    documents: [
      {
        id: "proposal",
        project_id: "p",
        stage_id: "s",
        name: "Proposal",
        document_role: "Proposal",
        category: "document",
        published: true,
      },
      {
        id: "contract",
        project_id: "p",
        stage_id: "s",
        name: "Contract",
        document_role: "Contract",
        category: "document",
        published: true,
      },
      {
        id: "final",
        project_id: "p",
        stage_id: "s",
        name: "Final",
        document_role: "Invoice",
        category: "final",
        published: true,
      },
    ],
    prospectSpaces: [space],
    notes: [{ body: "SECRET" }],
    assets: [{ name: "Other account return" }],
    proposalResponses: [{ message: "PRIVATE OWNER DATA" }],
  } as unknown as WorkspaceData;
  assert.deepEqual(previewProspect(data, p).documents, []);
  space.release_step = "proposal";
  assert.deepEqual(
    previewProspect(data, p).documents.map((d) => d.id),
    ["proposal"],
  );
  space.release_step = "agreement";
  assert.deepEqual(
    previewProspect(data, p).documents.map((d) => d.id),
    ["proposal", "contract"],
  );
  const preview = previewProspect(data, p);
  assert.deepEqual(preview.returns, []);
  assert.deepEqual(preview.responses, []);
  assert.equal("stages" in preview, false);
  assert.equal(JSON.stringify(preview).includes("SECRET"), false);
  space.enquiry_status = "closed";
  assert.deepEqual(previewProspect(data, p).documents, []);
  space.enquiry_status = "new";
  space.enabled = false;
  assert.deepEqual(previewProspect(data, p).documents, []);
});
test("client labels distinguish contacts, potential, not-proceeding and verified active projects", () => {
  const p = {
    id: "p",
    client_id: "c",
    contract_signed: false,
    deposit_paid: false,
  } as DbProject;
  const data = { projects: [], prospectSpaces: [] } as unknown as WorkspaceData;
  assert.equal(clientRelationship(data, "c"), "Contact");
  data.projects = [p];
  assert.equal(clientRelationship(data, "c"), "Potential client");
  data.prospectSpaces = [
    { project_id: "p", enquiry_status: "closed" } as ProspectSpace,
  ];
  assert.equal(clientRelationship(data, "c"), "Not proceeding");
  p.contract_signed = true;
  assert.equal(clientRelationship(data, "c"), "Not proceeding");
  p.deposit_paid = true;
  assert.equal(clientRelationship(data, "c"), "Active client");
});
