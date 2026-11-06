import { test } from "node:test";
import assert from "node:assert/strict";
import { workspaceInsights, workspaceOutlook } from "../lib/workspace-insights";
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

test("archived projects do not contribute to active pipeline or project payment charts", () => {
  const insights = workspaceInsights({
    ...base,
    projects: [{ ...project, archived_at: "2026-10-30T00:00:00Z" }],
  });
  assert.equal(insights.phases.flatMap((p) => p.projects).length, 0);
});

test("outlook groups current values by estimated completion month across years, preserving payment pennies and scope", () => {
  const data = {
    ...base,
    projects: [
      { ...project, due: "2026-11-30" },
      {
        ...project,
        id: "web",
        type: "Website Design" as const,
        due: "2027-01-31",
        deposit_paid: false,
        final_paid: true,
      },
      { ...project, id: "later", due: "2027-07-01" },
      { ...project, id: "past", due: "2026-10-31" },
      { ...project, id: "bad", due: "2027-02-30" },
      {
        ...project,
        id: "archived",
        due: "2026-11-01",
        archived_at: "2026-10-01T00:00:00Z",
      },
      { ...project, id: "deleting", client_id: "deleted", due: "2026-11-01" },
    ],
    clients: [
      ...base.clients,
      { ...base.clients[0], id: "deleted", deletion_pending: true },
    ],
  };
  const before = JSON.stringify(data);
  const outlook = workspaceOutlook(data, "All projects", "2026-11");
  assert.deepEqual(
    outlook.months.map((m) => m.month),
    ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"],
  );
  assert.deepEqual(
    outlook.months.map((m) => [
      m.total,
      m.received,
      m.projects.map((p) => p.id),
    ]),
    [
      [10001, 5001, ["p"]],
      [0, 0, []],
      [10001, 5000, ["web"]],
      [0, 0, []],
      [0, 0, []],
      [0, 0, []],
    ],
  );
  assert.equal(outlook.outsidePeriod, 2);
  assert.equal(outlook.undated, 1);
  const yearly = workspaceOutlook(data, "All projects", "2026-11", 12);
  assert.equal(yearly.months[8].projects[0].id, "later");
  assert.equal(yearly.outsidePeriod, 1);
  const websites = workspaceOutlook(data, "Website Design", "2026-11");
  assert.equal(websites.months.flatMap((m) => m.projects).length, 1);
  assert.equal(websites.outsidePeriod, 0);
  assert.equal(websites.undated, 0);
  assert.equal(JSON.stringify(data), before);
});

test("outlook handles empty views and invalid month requests without projecting client data", () => {
  assert.deepEqual(
    workspaceOutlook({ ...base, role: "client" }, "All projects", "2026-11"),
    { months: [], outsidePeriod: 0, undated: 0 },
  );
  for (const start of ["2026-13", "November", "2026-2", "", "9999-12"]) {
    assert.deepEqual(workspaceOutlook(base, "All projects", start).months, []);
  }
  const empty = workspaceOutlook(
    { ...base, projects: [] },
    "All projects",
    "2026-11",
  );
  assert.equal(empty.months.length, 6);
  assert.equal(
    empty.months.reduce((sum, m) => sum + m.total, 0),
    0,
  );
});

test("progress uses verified stage state, includes internal milestones and leaves release flags unchanged", () => {
  const data = {
    ...base,
    stages: [
      { ...stage, visible: false, status: "Completed" },
      {
        ...stage,
        id: "final",
        purpose: "final_payment" as const,
        status: "Completed",
      },
      { ...stage, id: "another", project_id: "another", status: "Completed" },
    ],
  };
  const before = JSON.stringify(data);
  const row = workspaceInsights(data).progress[0];
  assert.deepEqual(
    { completed: row.completed, total: row.total, percent: row.percent },
    { completed: 1, total: 2, percent: 50 },
  );
  assert.equal(
    workspaceInsights({ ...base, stages: [] }).progress[0].percent,
    0,
  );
  assert.deepEqual(workspaceInsights({ ...data, role: "client" }).progress, []);
  assert.equal(JSON.stringify(data), before);
});
