import { test } from "node:test";
import assert from "node:assert/strict";
import type { WorkspaceData } from "../lib/workspace";
import { londonDate, workspaceDeadlines } from "../lib/workspace-deadlines";

function fixture() {
  const project = {
    id: "p",
    client_id: "c",
    name: "Identity",
    type: "Brand Identity",
    due: "2026-03-28",
    contract_signed: true,
    deposit_paid: true,
    final_paid: false,
    final_approved: false,
  };
  return {
    role: "admin",
    clients: [
      { id: "c", name: "Fictional client" },
      { id: "deleting", name: "Deleting", deletion_pending: true },
    ],
    projects: [
      project,
      { ...project, id: "q", name: "Website", due: "2026-04-04" },
    ],
    stages: [{ id: "s", project_id: "p", name: "Presentation", visible: true }],
    clientActions: [
      {
        id: "next",
        project_id: "p",
        title: "Supply copy",
        status: "To do",
        due: "2026-03-29",
      },
      {
        id: "late",
        project_id: "p",
        title: "Supply images",
        status: "To do",
        due: "2026-03-27",
      },
      {
        id: "done",
        project_id: "p",
        title: "Completed",
        status: "Done",
        due: "2026-03-28",
      },
      {
        id: "end",
        project_id: "p",
        title: "Month end",
        status: "To do",
        due: "2026-04-26",
      },
      {
        id: "far",
        project_id: "p",
        title: "Later",
        status: "To do",
        due: "2026-04-27",
      },
      {
        id: "bad",
        project_id: "p",
        title: "Invalid",
        status: "To do",
        due: "2026-02-31",
      },
    ],
    documents: [
      {
        id: "d",
        project_id: "p",
        stage_id: "s",
        name: "Concept.pdf",
        version_label: "v2",
        category: "presentation",
        published: true,
        review_due: "2026-04-03",
      },
    ],
    feedback: [],
  } as unknown as WorkspaceData;
}

test("calendar windows include today, respect 7/30-day boundaries across BST, separate overdue and never mutate records", () => {
  const data = fixture(),
    before = JSON.stringify(data);
  const week = workspaceDeadlines(data, "2026-03-28");
  assert.deepEqual(
    week.items.map((i) => i.id),
    ["project-p", "action-next", "review-d"],
  );
  assert.deepEqual(
    week.items.map((i) => i.daysFromToday),
    [0, 1, 6],
  );
  assert.equal(week.total, 7);
  assert.equal(week.overdue, 1);
  assert.equal(workspaceDeadlines(data, "2026-03-28", "month").items.length, 5);
  assert.deepEqual(
    workspaceDeadlines(data, "2026-03-28", "overdue").items.map((i) => i.id),
    ["action-late"],
  );
  assert.equal(workspaceDeadlines(data, "2026-03-28", "all").items.length, 7);
  assert.equal(week.items[1].href, "#client-actions");
  assert.equal(week.items[2].href, "#stage-s");
  assert.equal(week.items[2].title, "Concept.pdf · v2");
  assert.equal(JSON.stringify(data), before);
});

test("non-owner data, invalid dates, archives, deleting clients, closed prospects and orphan records contribute no entries or counts", () => {
  const data = fixture();
  assert.deepEqual(
    workspaceDeadlines({ ...data, role: "client" }, "2026-03-28"),
    { items: [], total: 0, overdue: 0 },
  );
  assert.deepEqual(workspaceDeadlines(data, "2026-02-31"), {
    items: [],
    total: 0,
    overdue: 0,
  });
  const original = workspaceDeadlines(data, "2026-03-28", "all");
  const p = data.projects[0];
  data.projects.push(
    { ...p, id: "archived", archived_at: "2026-03-01T00:00:00Z" },
    { ...p, id: "deleting", client_id: "deleting" },
    { ...p, id: "closed", contract_signed: false, deposit_paid: false },
    { ...p, id: "orphan", client_id: "missing" },
  );
  data.prospectSpaces = [
    { project_id: "closed", enquiry_status: "closed" },
  ] as WorkspaceData["prospectSpaces"];
  for (const projectId of [
    "archived",
    "deleting",
    "closed",
    "orphan",
    "unknown",
  ]) {
    data.clientActions!.push({
      id: projectId,
      project_id: projectId,
      title: "Excluded task",
      status: "To do",
      due: "2026-03-28",
    });
    data.documents.push({
      ...data.documents[0],
      id: projectId,
      project_id: projectId,
    });
  }
  assert.deepEqual(workspaceDeadlines(data, "2026-03-28", "all"), original);
});

test("presentation dates require an available shared version; approval/revision responses complete that review but comments do not", () => {
  const data = fixture();
  const original = data.documents[0];
  const hasReview = () =>
    workspaceDeadlines(data, "2026-03-28").items.some(
      (i) => i.kind === "review",
    );
  assert.equal(hasReview(), true);
  for (const altered of [
    { published: false },
    { scan_state: "pending" },
    { scan_state: "rejected" },
    { stage_id: "missing" },
    { category: "document" },
  ]) {
    data.documents[0] = { ...original, ...altered } as typeof original;
    assert.equal(hasReview(), false);
  }
  data.documents[0] = original;
  data.stages[0].visible = false;
  assert.equal(hasReview(), false);
  data.stages[0].visible = true;
  data.projects[0].deposit_paid = false;
  assert.equal(hasReview(), false);
  data.projects[0].deposit_paid = true;
  data.feedback = [
    { document_id: "d", decision: "comment" },
  ] as WorkspaceData["feedback"];
  assert.equal(hasReview(), true);
  for (const decision of ["approved", "changes_requested"]) {
    data.feedback.push({
      document_id: "d",
      decision,
    } as WorkspaceData["feedback"][number]);
    assert.equal(hasReview(), false);
    data.feedback.pop();
  }
  data.documents[0] = { ...original, stage_id: null };
  assert.equal(
    workspaceDeadlines(data, "2026-03-28").items.find(
      (i) => i.kind === "review",
    )?.href,
    "#documents",
  );
  assert.equal(data.projects[0].final_approved, false);
  assert.equal(data.projects[0].final_paid, false);
});

test("equal-date entries retain their original order and record kinds cannot collide", () => {
  const data = fixture();
  data.projects = [data.projects[0]];
  data.clientActions = ["p", "second"].map((id) => ({
    id,
    project_id: "p",
    title: id,
    due: "2026-03-28",
    status: "To do",
  }));
  data.documents[0].id = "p";
  data.documents[0].review_due = "2026-03-28";
  assert.deepEqual(
    workspaceDeadlines(data, "2026-03-28").items.map((i) => i.id),
    ["project-p", "action-p", "action-second", "review-p"],
  );
});

test("London calendar days include midnight rollover and GMT/BST without interpreting date-only fields in the viewer's timezone", () => {
  assert.equal(londonDate(new Date("2026-07-01T23:30:00Z")), "2026-07-02");
  assert.equal(londonDate(new Date("2026-11-03T23:30:00Z")), "2026-11-03");
  const data = fixture();
  data.projects[0].due = "2028-02-29";
  assert.equal(
    workspaceDeadlines(data, "2028-02-29").items.find(
      (i) => i.kind === "project",
    )?.daysFromToday,
    0,
  );
  data.projects[0].due = "2026-02-29";
  assert.equal(
    workspaceDeadlines(data, "2026-02-28").items.some(
      (i) => i.kind === "project" && i.projectId === "p",
    ),
    false,
  );
});
