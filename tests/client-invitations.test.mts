import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClientInvitation } from "../lib/supabase/client-invitations";
const client = "10000000-0000-4000-8000-000000000001",
  user = "20000000-0000-4000-8000-000000000001";
function fixture({
  existing = true,
  saveFails = false,
  lookupFails = false,
  generatedEmail = "client@example.com",
  confirmed = false,
} = {}) {
  const calls: string[] = [];
  const db = {
    rpc: async (name: string) => {
      calls.push(name);
      return name === "client_invitations_ready"
        ? { data: true, error: null }
        : name === "client_invitation_account"
          ? {
              data: existing ? user : null,
              error: lookupFails
                ? { message: "Account already connected elsewhere" }
                : null,
            }
          : {
              data: client,
              error: saveFails ? { message: "Invitation unavailable" } : null,
            };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: client, email: "client@example.com" },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  const service = () => {
    calls.push("service");
    return {
      auth: {
        admin: {
          generateLink: async () => {
            calls.push("generateLink");
            return {
              data: {
                user: {
                  id: user,
                  email: generatedEmail,
                  email_confirmed_at: confirmed
                    ? "2026-01-01T00:00:00Z"
                    : undefined,
                },
                properties: {
                  hashed_token: "fictional-token-hash-at-least-20",
                },
              },
              error: null,
            };
          },
          deleteUser: () => {
            throw Error("Auth accounts must never be deleted");
          },
        },
      },
    } as unknown as SupabaseClient;
  };
  return { db, service, calls };
}
test("returning clients use their own sign-in without provider tokens, account deletion or password changes", async () => {
  const f = fixture();
  const r = await createClientInvitation(
    f.db,
    f.service,
    client,
    "https://studio.example",
  );
  assert.equal(r.link, "https://studio.example/login?invited=1");
  assert.equal(f.calls.includes("service"), false);
  assert.ok(f.calls.includes("record_client_invitation"));
});
test("new clients get a private invitation only after a matching account and portal permission are saved", async () => {
  const f = fixture({ existing: false });
  const r = await createClientInvitation(
    f.db,
    f.service,
    client,
    "https://studio.example",
  );
  assert.match(r.link, /^https:\/\/studio.example\/auth\/confirm\?token_hash=/);
  assert.ok(
    f.calls.indexOf("generateLink") <
      f.calls.indexOf("record_client_invitation"),
  );
});
test("identity conflicts and persistence failures return no token and never delete/reset an existing Auth account", async () => {
  const conflict = fixture({ lookupFails: true });
  await assert.rejects(() =>
    createClientInvitation(
      conflict.db,
      conflict.service,
      client,
      "https://studio.example",
    ),
  );
  assert.equal(conflict.calls.includes("service"), false);
  const failed = fixture({ existing: false, saveFails: true });
  await assert.rejects(() =>
    createClientInvitation(
      failed.db,
      failed.service,
      client,
      "https://studio.example",
    ),
  );
  const registered = fixture({ existing: false, confirmed: true });
  await assert.rejects(() =>
    createClientInvitation(
      registered.db,
      registered.service,
      client,
      "https://studio.example",
    ),
  );
  assert.equal(registered.calls.includes("record_client_invitation"), false);
  const mismatch = fixture({
    existing: false,
    generatedEmail: "owner@example.com",
  });
  await assert.rejects(() =>
    createClientInvitation(
      mismatch.db,
      mismatch.service,
      client,
      "https://studio.example",
    ),
  );
  assert.equal(mismatch.calls.includes("record_client_invitation"), false);
});
