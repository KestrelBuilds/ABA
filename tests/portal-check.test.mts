import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkClientPortals } from "../lib/supabase/portal-check";
function fixtures(cleanupFails = false) {
  const calls: { table: string; column: string; ids: string[] }[] = [];
  const deleted: string[] = [];
  const owner = {
    from() {
      return {
        insert: async () => ({
          error: {
            message: "Fixture failure: must not leak raw provider output",
          },
        }),
      };
    },
  };
  const service = {
    auth: {
      admin: {
        createUser: async () => ({
          data: { user: { id: "temporary-user-only" } },
          error: null,
        }),
        deleteUser: async (id: string) => {
          deleted.push(id);
          return { error: null };
        },
      },
    },
    from(table: string) {
      return {
        delete() {
          return this;
        },
        update() {
          return this;
        },
        async in(column: string, ids: string[]) {
          calls.push({ table, column, ids });
          return { error: cleanupFails ? { message: "Cleanup error" } : null };
        },
      };
    },
  };
  return {
    owner: owner as unknown as SupabaseClient,
    service: service as unknown as SupabaseClient,
    calls,
    deleted,
  };
}
test("failed fixture setup still deletes the temporary account and only scoped records", async () => {
  const f = fixtures();
  const result = await checkClientPortals(f.owner, f.service);
  assert.equal(result.ok, false);
  assert.match(result.message, /Temporary client setup could not be completed/);
  assert.doesNotMatch(result.message, /must not leak/);
  assert.deepEqual(f.deleted, ["temporary-user-only"]);
  assert.ok(f.calls.some((c) => c.table === "projects"));
  assert.ok(f.calls.some((c) => c.table === "clients"));
  assert.ok(f.calls.every((c) => c.ids.length > 0));
  for (const c of f.calls.filter((c) =>
    ["projects", "clients", "invitations"].includes(c.table),
  ))
    assert.ok(c.ids.every((id) => /^[0-9a-f-]{36}$/.test(id)));
});
test("cleanup failure is reported instead of claiming accounts, files and records were removed", async () => {
  const f = fixtures(true);
  const result = await checkClientPortals(f.owner, f.service);
  assert.equal(result.ok, false);
  assert.match(result.message, /cleanup needs attention/);
  assert.doesNotMatch(
    result.message,
    /accounts, files and records were removed/,
  );
  assert.deepEqual(f.deleted, ["temporary-user-only"]);
});
