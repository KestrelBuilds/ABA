import { test } from "node:test";
import assert from "node:assert/strict";
import { fileVisibility } from "../lib/file-visibility";
import { clientPreview } from "../lib/client-preview";
import type {
  DbProject,
  DbStage,
  DbDocument,
  WorkspaceData,
} from "../lib/workspace";

test("file visibility explanations agree with owner preview across publication, stage, onboarding and delivery gates", () => {
  for (let flags = 0; flags < 16; flags++) {
    const project = {
      id: "p",
      client_id: "c",
      contract_signed: Boolean(flags & 1),
      deposit_paid: Boolean(flags & 2),
      final_approved: Boolean(flags & 4),
      final_paid: Boolean(flags & 8),
    } as DbProject;
    for (const published of [false, true])
      for (const visible of [false, true])
        for (const category of ["document", "final"]) {
          const stage = { id: "s", project_id: "p", visible } as DbStage;
          const document = {
            id: "d",
            project_id: "p",
            stage_id: "s",
            published,
            category,
          } as DbDocument;
          const data = {
            projects: [project],
            clients: [{ id: "c" }],
            stages: [stage],
            documents: [document],
            feedback: [],
            questionnaires: [],
            notes: [],
            audit: [],
          } as unknown as WorkspaceData;
          assert.equal(
            fileVisibility(document, project, [stage]).available,
            clientPreview(data, "p").documents.length === 1,
            JSON.stringify({ flags, published, visible, category }),
          );
        }
  }
});

test("locked files list all outstanding requirements and never mistake published for accessible", () => {
  const project = {
    id: "p",
    contract_signed: false,
    deposit_paid: false,
    final_approved: false,
    final_paid: false,
  } as DbProject;
  const result = fileVisibility(
    { published: true, category: "final", stage_id: "s" } as DbDocument,
    project,
    [{ id: "s", project_id: "p", visible: false } as DbStage],
  );
  assert.equal(result.available, false);
  for (const text of [
    "signed contract",
    "deposit payment",
    "internal stage",
    "final creative approval",
    "final payment",
  ])
    assert.ok(result.message.includes(text));
});

test("unattached files need no stage; unresolved or mismatched stages remain locked", () => {
  const project = {
    id: "p",
    contract_signed: true,
    deposit_paid: true,
  } as DbProject;
  const document = { published: true, category: "document" } as DbDocument;
  assert.equal(fileVisibility(document, project, []).available, true);
  assert.equal(
    fileVisibility({ ...document, stage_id: "missing" }, project, []).available,
    false,
  );
  assert.equal(
    fileVisibility({ ...document, stage_id: "s" }, project, [
      { id: "s", project_id: "other", visible: true } as DbStage,
    ]).available,
    false,
  );
});

test("only explicitly enabled shared contract documents can bypass onboarding in the limited area", () => {
  const project = {
    id: "p",
    contract_signed: false,
    deposit_paid: false,
  } as DbProject;
  const doc = {
    published: true,
    document_role: "Contract",
    category: "document",
    stage_id: "s",
  } as DbDocument;
  const stages = [{ id: "s", project_id: "p", visible: true } as DbStage];
  const exchanges = [{ project_id: "p", stage_id: "s", enabled: true }];
  assert.equal(fileVisibility(doc, project, stages, exchanges).available, true);
  assert.match(
    fileVisibility(doc, project, stages, exchanges).message,
    /initial contract area only/,
  );
  for (const altered of [
    { ...doc, published: false },
    { ...doc, document_role: "Invoice" },
    { ...doc, category: "final" },
  ])
    assert.equal(
      fileVisibility(altered, project, stages, exchanges).available,
      false,
    );
  assert.equal(
    fileVisibility(doc, project, [{ ...stages[0], visible: false }], exchanges)
      .available,
    false,
  );
  assert.equal(
    fileVisibility(doc, project, stages, [{ ...exchanges[0], enabled: false }])
      .available,
    false,
  );
});
