import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkExpiredInvitation,
  invitationChecksReady,
} from "../lib/supabase/invitation-check";

const scope = {
  clientId: "allocated-client",
  projectId: "allocated-project",
  userId: "allocated-user",
};
const expectedError = {
  code: "P0001",
  message: "Ask Alex for a fresh invitation",
};
function fixture(response: unknown, membership = false) {
  const renewed: unknown[] = [],
    reads: unknown[] = [];
  const owner = {
    rpc: async (name: string, args: unknown) => {
      renewed.push({ name, args });
      return { error: null, data: "invitation" };
    },
  } as unknown as SupabaseClient;
  const session = {
    rpc: async () => response,
    from: (table: string) => ({
      select: () => ({
        eq: async (column: string, value: string) => {
          reads.push({ table, column, value });
          return {
            error: null,
            data:
              membership && table === "profiles" ? [{ id: scope.userId }] : [],
          };
        },
      }),
    }),
  } as unknown as SupabaseClient;
  return { owner, session, renewed, reads };
}

test("expected expiry denial is followed by scoped empty reads before renewing only the allocated account", async () => {
  const f = fixture({ error: expectedError, data: null, status: 400 });
  await checkExpiredInvitation(f.owner, f.session, scope);
  assert.deepEqual(f.reads, [
    { table: "profiles", column: "id", value: scope.userId },
    { table: "projects", column: "id", value: scope.projectId },
  ]);
  assert.deepEqual(f.renewed, [
    {
      name: "record_client_invitation",
      args: { target: scope.clientId, account: scope.userId },
    },
  ]);
});

test("success, network errors, unrelated SQL errors and server failures never count as expiry rejection", async () => {
  for (const response of [
    { error: null, data: null, status: 200 },
    { error: { code: "FETCH_ERROR", message: "Network failure" }, status: 0 },
    {
      error: { code: "P0001", message: "Another application error" },
      status: 400,
    },
    { error: expectedError, status: 503 },
    { error: expectedError },
  ]) {
    const f = fixture(response);
    await assert.rejects(
      () => checkExpiredInvitation(f.owner, f.session, scope),
      /Expired invitation rejection did not pass/,
    );
    assert.equal(f.renewed.length, 0);
    assert.equal(f.reads.length, 0);
  }
});

test("an expired invitation rejection cannot hide an existing unexpected membership", async () => {
  const f = fixture({ error: expectedError, status: 400 }, true);
  await assert.rejects(
    () => checkExpiredInvitation(f.owner, f.session, scope),
    /cannot create client membership/,
  );
  assert.equal(f.renewed.length, 0);
});

test("missing invitation capability is unavailable; service errors are failures rather than skipped checks", async () => {
  for (const code of ["PGRST202", "42883"]) {
    const owner = {
      rpc: async () => ({ error: { code }, status: 404 }),
    } as unknown as SupabaseClient;
    assert.equal(await invitationChecksReady(owner), false);
  }
  const owner = {
    rpc: async () => ({
      error: { code: "XX000", message: "Private provider output" },
    }),
  } as unknown as SupabaseClient;
  await assert.rejects(
    () => invitationChecksReady(owner),
    /Invitation capability check could not be completed/,
  );
  for (const response of [
    { error: { code: "PGRST202" }, status: 503 },
    { error: null, data: true, status: 503 },
    { error: null, data: "true", status: 200 },
  ]) {
    const unavailable = {
      rpc: async () => response,
    } as unknown as SupabaseClient;
    await assert.rejects(
      () => invitationChecksReady(unavailable),
      /Invitation capability/,
    );
  }
  for (const data of [true, false]) {
    const available = {
      rpc: async () => ({ error: null, data, status: 200 }),
    } as unknown as SupabaseClient;
    assert.equal(await invitationChecksReady(available), data);
  }
});
