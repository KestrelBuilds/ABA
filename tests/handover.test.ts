import { test } from "node:test";
import assert from "node:assert/strict";
import {
  goodbyeOutline,
  handoverPreparation,
  stageFileDefaults,
} from "../lib/handover";
import type { WorkspaceData, DbProject } from "../lib/workspace";
test("upload suggestions use exact standard stage names, stay editable metadata and never infer verified payment/signature", () => {
  assert.deepEqual(
    stageFileDefaults({ name: "Contract", stream: "Onboarding" }),
    { role: "Contract", category: "document" },
  );
  assert.deepEqual(
    stageFileDefaults({ name: "Invoice", stream: "Onboarding" }),
    { role: "Invoice", category: "document" },
  );
  assert.deepEqual(
    stageFileDefaults({ name: "Project Proposal", stream: "Onboarding" }),
    { role: "Proposal", category: "document" },
  );
  assert.deepEqual(
    stageFileDefaults({ name: "Goodbye Packet", stream: "Delivery" }),
    { role: "Handover", category: "final" },
  );
  assert.deepEqual(
    stageFileDefaults({ name: "Launch & Handover", stream: "Website Design" }),
    { role: "Handover", category: "final" },
  );
  assert.deepEqual(
    stageFileDefaults({ name: "Contract", stream: "Brand Identity" }),
    { role: "General", category: "document" },
  );
  assert.deepEqual(
    stageFileDefaults({
      name: "Custom final approval",
      stream: "Brand Identity",
    }),
    { role: "General", category: "document" },
  );
});
test("handover readiness counts actual records without treating uploaded packets, support or progress as approval/payment", () => {
  const p = {
    id: "p",
    contract_signed: true,
    deposit_paid: true,
    final_approved: false,
    final_paid: false,
  } as DbProject;
  const data = {
    stages: [
      { id: "goodbye", project_id: "p", name: "Goodbye Packet", visible: true },
    ],
    documents: [
      {
        id: "f",
        project_id: "p",
        stage_id: "goodbye",
        name: "Packet.pdf",
        category: "document",
        published: true,
      },
      {
        id: "final",
        project_id: "p",
        category: "final",
        name: "Files.pdf",
        published: true,
      },
      { id: "other", project_id: "other", category: "final", published: true },
    ],
    handovers: [{ project_id: "p", body: "   " }],
    projectDetails: [{ project_id: "p", support: "" }],
  } as unknown as WorkspaceData;
  const before = JSON.stringify(data);
  const r = handoverPreparation(data, p);
  assert.equal(r.finals.length, 1);
  assert.equal(r.readyFiles.length, 0);
  assert.equal(r.packets.length, 1);
  assert.equal(r.packetNeedsReleaseRule, true);
  assert.equal(r.hasHandoverNotes, false);
  assert.equal(r.hasSupport, false);
  assert.equal(r.packetHref, "#stage-goodbye");
  assert.equal(r.missing.length, 2);
  assert.equal(JSON.stringify(data), before);
  assert.equal(
    handoverPreparation(data, { ...p, final_approved: true, final_paid: true })
      .readyFiles.length,
    1,
  );
});
test("goodbye drafts respect branding/Framer scope, share combined sections once and leave business terms as placeholders", () => {
  const brand = goodbyeOutline("Brand Identity"),
    web = goodbyeOutline("Website Design"),
    both = goodbyeOutline("Both");
  assert.match(brand, /USING YOUR BRAND FILES/);
  assert.doesNotMatch(brand, /YOUR FRAMER WEBSITE/);
  assert.match(web, /YOUR FRAMER WEBSITE/);
  assert.doesNotMatch(web, /USING YOUR BRAND FILES/);
  assert.equal(both.split("SUPPORT & NEXT STEPS").length, 2);
  assert.match(both, /\[Add the live website URL/);
  assert.match(both, /not shared with the client/);
  assert.doesNotMatch(
    both,
    /unlimited support|hosting is free|automatic transfer/i,
  );
});
