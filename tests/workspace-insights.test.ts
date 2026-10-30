import { test } from "node:test";
import assert from "node:assert/strict";
import { workspaceInsights } from "../lib/workspace-insights";
import type { WorkspaceData, DbProject, DbStage } from "../lib/workspace";
const project = {
  id: "p",
  client_id: "c",
  name: "Branding",
  type: "Brand Identity",
  budget: 100.01,
  contract_signed: true,
  deposit_paid: true,
  final_paid: false,
  final_approved: false,
} as DbProject;
const stage = {
  id: "s",
  project_id: "p",
  name: "Design",
  stream: "Brand Identity",
  position: 0,
  status: "In Progress",
  visible: true,
} as DbStage;
const base = {
  role: "admin",
  clients: [{ id: "c" }],
  projects: [project],
  stages: [stage],
} as WorkspaceData;
test("insights group each project by verified gates and the first incomplete ordered stage without inventing delivery", () => {
  assert.equal(
    workspaceInsights(base).phases.find((p) => p.key === "branding")!.projects
      .length,
    1,
  );
  const completed = { ...stage, status: "Completed" };
  assert.equal(
    workspaceInsights({ ...base, stages: [completed] }).phases.find(
      (p) => p.key === "handover",
    )!.projects.length,
    1,
  );
  assert.equal(
    workspaceInsights({
      ...base,
      stages: [completed],
      projects: [{ ...project, deposit_paid: false }],
    }).phases.find((p) => p.key === "onboarding")!.projects.length,
    1,
  );
  assert.equal(
    workspaceInsights({
      ...base,
      stages: [completed],
      projects: [{ ...project, final_paid: true, final_approved: true }],
    }).phases.find((p) => p.key === "complete")!.projects.length,
    1,
  );
  const final = {
    ...stage,
    purpose: "final_payment" as const,
    status: "Completed",
    position: 1,
  };
  assert.equal(
    workspaceInsights({ ...base, stages: [final, completed] }).phases.find(
      (p) => p.key === "branding",
    )!.projects.length,
    1,
  );
  assert.equal(
    workspaceInsights({ ...base, stages: [] }).phases.find(
      (p) => p.key === "other",
    )!.projects.length,
    1,
  );
  assert.equal(
    workspaceInsights({
      ...base,
      stages: [{ ...stage, stream: "Custom" }],
    }).phases.find((p) => p.key === "other")!.projects.length,
    1,
  );
  assert.equal(
    workspaceInsights({
      ...base,
      stages: [{ ...stage, stream: "Website Design" }],
    }).phases.find((p) => p.key === "website")!.projects.length,
    1,
  );
});
test("payment chart conserves odd pennies and uses explicit independent payment flags rather than progress or approval", () => {
  assert.deepEqual(workspaceInsights(base).value, {
    total: 10001,
    received: 5001,
    outstanding: 5000,
  });
  assert.deepEqual(
    workspaceInsights({
      ...base,
      projects: [{ ...project, deposit_paid: false, final_paid: true }],
    }).value,
    { total: 10001, received: 5000, outstanding: 5001 },
  );
  assert.deepEqual(
    workspaceInsights({
      ...base,
      projects: [{ ...project, deposit_paid: false, final_approved: true }],
      stages: [{ ...stage, status: "Completed" }],
    }).value,
    { total: 10001, received: 0, outstanding: 10001 },
  );
  assert.deepEqual(
    workspaceInsights({ ...base, projects: [{ ...project, final_paid: true }] })
      .value,
    { total: 10001, received: 10001, outstanding: 0 },
  );
  assert.deepEqual(
    workspaceInsights({ ...base, projects: [{ ...project, budget: 0 }] }).value,
    { total: 0, received: 0, outstanding: 0 },
  );
});
test("chart filters share a consistent scope, exclude pending deletions and never expose an owner summary for clients", () => {
  const data = {
    ...base,
    projects: [
      project,
      { ...project, id: "p2", type: "Both" as const },
      { ...project, id: "p3", client_id: "deleted" },
    ],
    clients: [
      ...base.clients,
      { ...base.clients[0], id: "deleted", deletion_pending: true },
    ],
  };
  assert.equal(workspaceInsights(data).projects.length, 2);
  assert.equal(workspaceInsights(data, "Both").projects.length, 1);
  assert.deepEqual(workspaceInsights(data, "Website Design").value, {
    total: 0,
    received: 0,
    outstanding: 0,
  });
  assert.equal(
    workspaceInsights(data, "Brand Identity").phases.reduce(
      (n, p) => n + p.projects.length,
      0,
    ),
    1,
  );
  assert.equal(
    workspaceInsights({ ...data, role: "client" }).projects.length,
    0,
  );
  assert.deepEqual(workspaceInsights({ ...base, projects: [] }).value, {
    total: 0,
    received: 0,
    outstanding: 0,
  });
  assert.equal(data.projects.length, 3);
});
