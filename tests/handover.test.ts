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

test("delivery review explains private, hidden, quarantined and archived files without releasing them or leaking another project", () => {
  const project = {
    id: "p",
    contract_signed: true,
    deposit_paid: true,
    final_approved: true,
    final_paid: true,
  } as DbProject;
  const data = {
    stages: [
      { id: "goodbye", project_id: "p", name: "Goodbye Packet", visible: true },
      { id: "hidden", project_id: "p", name: "Internal", visible: false },
      {
        id: "foreign",
        project_id: "other",
        name: "Other client's stage",
        visible: true,
      },
    ],
    documents: [
      {
        id: "ready",
        project_id: "p",
        stage_id: "goodbye",
        category: "final",
        published: true,
        scan_state: "clean",
      },
      { id: "draft", project_id: "p", category: "final", published: false },
      {
        id: "hidden",
        project_id: "p",
        stage_id: "hidden",
        category: "final",
        published: true,
      },
      {
        id: "pending",
        project_id: "p",
        category: "final",
        published: true,
        scan_state: "pending",
      },
      {
        id: "rejected",
        project_id: "p",
        category: "final",
        published: true,
        scan_state: "rejected",
      },
      {
        id: "packet",
        project_id: "p",
        stage_id: "goodbye",
        category: "document",
        published: true,
      },
      {
        id: "wrong-stage",
        project_id: "p",
        stage_id: "foreign",
        category: "final",
        published: true,
      },
      {
        id: "foreign-file",
        project_id: "other",
        category: "final",
        published: true,
      },
      {
        id: "ordinary",
        project_id: "p",
        category: "document",
        published: true,
      },
    ],
  } as unknown as WorkspaceData;
  const before = JSON.stringify({ data, project });
  const result = handoverPreparation(data, project);
  assert.equal(result.reviewFiles.length, 7);
  assert.deepEqual(
    result.readyFiles.map((d) => d.id),
    ["ready"],
  );
  assert.equal(result.packetNeedsReleaseRule, true);
  const reviewed = (id: string) =>
    result.reviewFiles.find((f) => f.document.id === id)!;
  assert.equal(reviewed("ready").visibility.available, true);
  assert.equal(reviewed("ready").href, "#stage-goodbye");
  assert.equal(reviewed("packet").visibility.available, true);
  assert.match(reviewed("draft").visibility.message, /private draft/);
  assert.match(reviewed("hidden").visibility.message, /internal stage/);
  assert.match(
    reviewed("pending").visibility.message,
    /awaiting security checks/,
  );
  assert.match(
    reviewed("rejected").visibility.message,
    /blocked by security checks/,
  );
  assert.match(reviewed("wrong-stage").visibility.message, /stage association/);
  assert.equal(reviewed("wrong-stage").stage, undefined);
  assert.equal(reviewed("wrong-stage").href, "#documents");
  assert.equal(
    result.reviewFiles.some((f) => f.document.id === "foreign-file"),
    false,
  );
  assert.equal(
    result.reviewFiles.some((f) => f.document.id === "ordinary"),
    false,
  );
  const suspended = handoverPreparation(data, {
    ...project,
    archived_at: "2026-11-03T00:00:00Z",
    archived_client_access: "suspend",
  });
  assert.equal(suspended.missing.length, 0);
  assert.equal(suspended.readyFiles.length, 0);
  assert.ok(suspended.reviewFiles.every((f) => !f.visibility.available));
  const retained = handoverPreparation(data, {
    ...project,
    archived_at: "2026-11-03T00:00:00Z",
    archived_client_access: "retain",
  });
  assert.deepEqual(
    retained.readyFiles.map((d) => d.id),
    ["ready"],
  );
  assert.equal(JSON.stringify({ data, project }), before);
});
