import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectFiles,
  filterProjectFiles,
  groupProjectFiles,
} from "../lib/project-files";
import { clientPreview } from "../lib/client-preview";
import type { WorkspaceData } from "../lib/workspace";

function fixture(): WorkspaceData {
  return {
    role: "admin",
    emailInvitesReady: false,
    clients: [
      {
        id: "c",
        name: "Example",
        contact: "Example",
        email: "example@example.com",
        sector: "Design",
      },
    ],
    projects: [
      {
        id: "p",
        client_id: "c",
        name: "Example",
        type: "Brand Identity",
        due: "2027-01-01",
        budget: 100,
        contract_signed: true,
        deposit_paid: true,
        final_approved: false,
        final_paid: false,
      },
    ],
    stages: [
      {
        id: "later",
        project_id: "p",
        name: "Présentation",
        stream: "Brand Identity",
        position: 2,
        status: "In Progress",
        visible: true,
      },
      {
        id: "first",
        project_id: "p",
        name: "Agreement",
        stream: "Onboarding",
        position: 0,
        status: "Not Started",
        visible: false,
      },
      {
        id: "foreign",
        project_id: "other",
        name: "Private foreign stage",
        stream: "Brand Identity",
        position: 1,
        status: "Not Started",
        visible: true,
      },
    ],
    documents: [
      {
        id: "design",
        project_id: "p",
        stage_id: "later",
        name: "Concept.pdf",
        category: "presentation",
        published: true,
        version_label: "v2",
      },
      {
        id: "contract",
        project_id: "p",
        stage_id: "first",
        name: "Agreement.pdf",
        category: "document",
        document_role: "Contract",
        published: true,
      },
      {
        id: "final",
        project_id: "p",
        name: "Delivery.pdf",
        category: "final",
        published: true,
      },
      {
        id: "draft",
        project_id: "p",
        name: "Draft.pdf",
        category: "document",
        published: false,
      },
      {
        id: "foreign-doc",
        project_id: "other",
        stage_id: "foreign",
        name: "Foreign.pdf",
        category: "presentation",
        published: true,
      },
    ],
    assets: [
      {
        id: "return",
        project_id: "p",
        stage_id: "first",
        contract_document_id: "contract",
        name: "Returned.pdf",
        created_at: "2026-10-29",
      },
      {
        id: "foreign-asset",
        project_id: "other",
        name: "Foreign return.pdf",
        created_at: "2026-10-29",
      },
    ],
    feedback: [],
    questionnaires: [],
    notes: [],
    audit: [],
  };
}

test("file library combines original project records once and follows journey order without merging uploads and returns", () => {
  const data = fixture();
  const before = JSON.stringify(data);
  const files = projectFiles(data, "p");
  assert.equal(files.length, 5);
  assert.equal(files[0].file, data.documents[0]);
  assert.equal(files[4].file, data.assets![0]);
  const groups = groupProjectFiles(files, data.stages);
  assert.deepEqual(
    groups.map((g) => g.id),
    ["first", "later", "project-wide"],
  );
  assert.deepEqual(
    groups[0].files.map((f) => f.source),
    ["document", "asset"],
  );
  assert.equal(groups.flatMap((g) => g.files).length, files.length);
  assert.equal(JSON.stringify(data), before);
});

test("file filters combine case-insensitive name, version, stage, type and explicit return association without guessing from filenames", () => {
  const data = fixture();
  const files = projectFiles(data, "p");
  const find = (query: string, kind = "all", stage = "all") =>
    filterProjectFiles(files, data.stages, { query, kind, stage }).map(
      (f) => f.file.id,
    );
  assert.deepEqual(find("  PRÉSENTATION  ", "presentation", "later"), [
    "design",
  ]);
  assert.deepEqual(find("V2"), ["design"]);
  assert.deepEqual(find("agreement", "Contract", "first"), ["contract"]);
  assert.deepEqual(find("", "returned", "first"), ["return"]);
  assert.deepEqual(find("", "Contract", "later"), []);
  assert.deepEqual(find("missing"), []);
  assert.deepEqual(find("", "final", "project-wide"), ["final"]);
  assert.equal(files.find((f) => f.file.id === "return")?.source, "asset");
  const missing = { ...data.documents[0], stage_id: "foreign" };
  const orphaned = groupProjectFiles(
    [{ source: "document", kind: "presentation", file: missing }],
    data.stages,
  );
  assert.equal(orphaned[0].id, "unavailable");
  assert.equal(orphaned[0].stage, undefined);
});

test("client library and available filter choices contain only the already permitted preview records across final release and revocation", () => {
  const data = fixture();
  let preview = clientPreview(data, "p");
  assert.deepEqual(
    projectFiles(preview, "p").map((f) => f.file.id),
    ["design"],
  );
  assert.deepEqual(
    groupProjectFiles(projectFiles(preview, "p"), preview.stages).map(
      (g) => g.id,
    ),
    ["later"],
  );
  data.projects[0].final_paid = true;
  assert.equal(projectFiles(clientPreview(data, "p"), "p").length, 1);
  data.projects[0].final_approved = true;
  preview = clientPreview(data, "p");
  assert.deepEqual(
    projectFiles(preview, "p").map((f) => f.file.id),
    ["design", "final"],
  );
  data.projects[0].contract_signed = false;
  assert.deepEqual(projectFiles(clientPreview(data, "p"), "p"), []);
});
