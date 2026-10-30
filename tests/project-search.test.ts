import { test } from "node:test";
import assert from "node:assert/strict";
import { findProjects, defaultProjectFilters } from "../lib/project-search";
import type { DbProject, DbClient } from "../lib/workspace";
const clients: DbClient[] = [
  {
    id: "a",
    name: "Málaga Studio",
    contact: "Fictional A",
    email: "a@example.com",
    sector: "Design",
  },
  {
    id: "b",
    name: "Beta Arts",
    contact: "Fictional B",
    email: "b@example.com",
    sector: "Design",
  },
];
const project = (
  id: string,
  name: string,
  type: DbProject["type"],
  client: string,
  due: string,
  archived = false,
): DbProject => ({
  id,
  name,
  type,
  client_id: client,
  due,
  budget: 100,
  contract_signed: true,
  deposit_paid: true,
  final_paid: true,
  final_approved: true,
  archived_at: archived ? "2026-10-30T00:00:00Z" : null,
  archived_client_access: "retain",
});
const data = {
  role: "admin" as const,
  clients,
  projects: [
    project("one", "Logo 10", "Brand Identity", "a", "2027-02-01"),
    project("two", "Framer build", "Website Design", "b", "2027-01-01"),
    project("three", "Brand and website", "Both", "a", "2027-01-01"),
    project("four", "Logo 2", "Brand Identity", "b", "2026-12-01", true),
  ],
};
test("project search combines client/project tokens, accents, service and deliberate archive scope without inferring completion", () => {
  assert.deepEqual(
    findProjects(data, {
      ...defaultProjectFilters,
      query: "  MALAGA   logo ",
      service: "Brand Identity",
    }).projects.map((p) => p.id),
    ["one"],
  );
  assert.equal(
    findProjects(data, defaultProjectFilters).total,
    3,
    "verified final flags alone never hide an active project",
  );
  assert.deepEqual(
    findProjects(data, {
      ...defaultProjectFilters,
      query: "beta logo",
      scope: "archived",
    }).projects.map((p) => p.id),
    ["four"],
  );
  assert.deepEqual(
    findProjects(data, {
      ...defaultProjectFilters,
      query: "malaga website",
      service: "Both",
    }).projects.map((p) => p.id),
    ["three"],
  );
  assert.deepEqual(
    findProjects(data, {
      ...defaultProjectFilters,
      query: "combined",
    }).projects.map((p) => p.id),
    ["three"],
  );
  assert.equal(
    findProjects(data, { ...defaultProjectFilters, query: "not found" })
      .projects.length,
    0,
  );
  assert.equal(
    findProjects(data, { ...defaultProjectFilters, scope: "all" }).total,
    4,
  );
});
test("project sorting is stable, preserves records, and uses estimated dates or natural names", () => {
  const original = structuredClone(data);
  assert.deepEqual(
    findProjects(data, { ...defaultProjectFilters, sort: "due" }).projects.map(
      (p) => p.id,
    ),
    ["two", "three", "one"],
  );
  assert.deepEqual(
    findProjects(data, {
      ...defaultProjectFilters,
      scope: "all",
      sort: "project",
    }).projects.map((p) => p.id),
    ["three", "two", "four", "one"],
  );
  assert.deepEqual(
    findProjects(data, {
      ...defaultProjectFilters,
      scope: "all",
      sort: "client",
    }).projects.map((p) => p.id),
    ["two", "four", "one", "three"],
  );
  assert.deepEqual(
    findProjects(data, defaultProjectFilters).projects.map((p) => p.id),
    ["one", "two", "three"],
  );
  assert.deepEqual(data, original);
});
test("owner project search returns no project rows or counts for client and preview data, including missing client labels", () => {
  assert.deepEqual(
    findProjects(
      { ...data, role: "client" },
      { ...defaultProjectFilters, scope: "all" },
    ),
    { projects: [], total: 0 },
  );
  const orphan = { ...data, clients: [] };
  assert.deepEqual(
    findProjects(orphan, {
      ...defaultProjectFilters,
      query: "framer",
    }).projects.map((p) => p.id),
    ["two"],
  );
  assert.equal(
    findProjects(orphan, { ...defaultProjectFilters, query: "malaga" }).projects
      .length,
    0,
  );
});
