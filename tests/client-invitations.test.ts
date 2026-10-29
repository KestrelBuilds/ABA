import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./helpers/database";
test("invitation lifecycle binds verified emails, rejects cross-client/owner identities and safely reinvites revoked accounts", async () => {
  const db = await testDatabase(10);
  const owner = randomUUID(),
    user = randomUUID(),
    other = randomUUID(),
    unconfirmed = randomUUID(),
    c1 = randomUUID(),
    c2 = randomUUID(),
    p1 = randomUUID(),
    p2 = randomUUID();
  const login = async (id: string) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  };
  const rows = async (sql: string, args: unknown[] = []) =>
    (await db.query<Record<string, any>>(sql, args)).rows;
  try {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at)values($1,'owner@example.com',now()),($2,' CLIENT@example.com ',now()),($3,'other@example.com',now()),($4,'unconfirmed@example.com',null)",
      [owner, user, other, unconfirmed],
    );
    await db.query(
      "insert into public.clients(id,name,contact,email)values($1,'One','Jamie','client@example.com'),($2,'Two','Robin','other@example.com')",
      [c1, c2],
    );
    await db.query(
      "insert into public.profiles(id,role,client_id)values($1,'admin',null),($2,'client',$3)",
      [owner, other, c2],
    );
    await db.query(
      "insert into public.projects(id,client_id,name,type,due,budget)values($1,$2,'One','Brand Identity','2027-01-01',0),($3,$4,'Two','Website Design','2027-01-01',0)",
      [p1, c1, p2, c2],
    );
    await db.query(
      "insert into public.prospect_spaces(project_id,enabled)values($1,true)",
      [p1],
    );
    await login(owner);
    assert.equal(
      (await rows("select public.client_invitation_account($1) as id", [c1]))[0]
        .id,
      user,
    );
    let status = (
      await rows("select public.client_portal_statuses() as data")
    )[0].data.find((s: any) => s.client_id === c1);
    assert.equal(status.state, "not_invited");
    assert.equal(status.eligible, true);
    await assert.rejects(() =>
      rows("select public.record_client_invitation($1,$2)", [c1, owner]),
    );
    await assert.rejects(() =>
      rows("select public.record_client_invitation($1,$2)", [c1, other]),
    );
    await rows("select public.record_client_invitation($1,$2)", [c1, user]);
    // Reapplying the setup cannot extend, revoke or accept an existing invitation.
    await db.exec("reset role");
    const { readFile } = await import("node:fs/promises");
    await db.exec(
      await readFile(
        "supabase/migrations/202610290010_client_invitations.sql",
        "utf8",
      ),
    );
    await login(owner);
    status = (
      await rows("select public.client_portal_statuses() as data")
    )[0].data.find((s: any) => s.client_id === c1);
    assert.equal(status.state, "pending");
    await login(other);
    await assert.rejects(() => rows("select public.client_portal_statuses()"));
    await assert.rejects(() =>
      rows("select public.client_invitation_account($1)", [c1]),
    );
    await assert.rejects(() =>
      rows("select public.record_client_invitation($1,$2)", [c1, user]),
    );
    await rows("select public.accept_invitation()");
    assert.equal((await rows("select * from public.profiles")).length, 1);
    await login(user);
    await rows("select public.accept_invitation()");
    await rows("select public.accept_invitation()");
    assert.equal(
      (await rows("select client_id from public.profiles"))[0].client_id,
      c1,
    );
    assert.equal((await rows("select * from public.projects")).length, 0); // Early invitation does not unlock the creative journey.
    await login(owner);
    status = (
      await rows("select public.client_portal_statuses() as data")
    )[0].data.find((s: any) => s.client_id === c1);
    assert.equal(status.state, "connected");
    await assert.rejects(() =>
      rows("select public.record_client_invitation($1,$2)", [c1, user]),
    );
    await rows("select public.revoke_client_access($1)", [c1]);
    await login(user);
    await assert.rejects(() => rows("select public.accept_invitation()"));
    assert.equal((await rows("select * from public.profiles")).length, 0);
    await login(owner);
    status = (
      await rows("select public.client_portal_statuses() as data")
    )[0].data.find((s: any) => s.client_id === c1);
    assert.equal(status.state, "revoked");
    await rows("select public.record_client_invitation($1,$2)", [c1, user]);
    await db.exec("reset role");
    await db.query(
      "update public.invitations set expires_at=now()-interval '1 minute' where user_id=$1",
      [user],
    );
    await login(user);
    await assert.rejects(() => rows("select public.accept_invitation()"));
    await login(owner);
    status = (
      await rows("select public.client_portal_statuses() as data")
    )[0].data.find((s: any) => s.client_id === c1);
    assert.equal(status.state, "expired");
    await rows("select public.record_client_invitation($1,$2)", [c1, user]);
    await db.exec("reset role");
    await db.query(
      "update public.clients set email='owner@example.com' where id=$1",
      [c1],
    );
    await login(owner);
    await assert.rejects(() =>
      rows("select public.client_invitation_account($1)", [c1]),
    );
    await login(user);
    await assert.rejects(() => rows("select public.accept_invitation()"));
    await db.exec("reset role");
    await db.query(
      "update public.clients set email='client@example.com' where id=$1",
      [c1],
    );
    await login(user);
    await rows("select public.accept_invitation()");
    await login(owner);
    await rows("select public.revoke_client_access($1)", [c1]);
    await db.exec("reset role");
    assert.equal((await rows("select * from auth.users")).length, 4);
    // A duplicate client cannot take an account which is currently connected elsewhere.
    await db.query(
      "update public.clients set email='other@example.com' where id=$1",
      [c1],
    );
    await login(owner);
    await assert.rejects(() =>
      rows("select public.client_invitation_account($1)", [c1]),
    );
    // An unconfirmed email is insufficient even if another sign-in method yielded a session.
    await db.exec("reset role");
    await db.query(
      "update public.clients set email='unconfirmed@example.com' where id=$1",
      [c1],
    );
    await login(owner);
    await rows("select public.record_client_invitation($1,$2)", [
      c1,
      unconfirmed,
    ]);
    await login(unconfirmed);
    await assert.rejects(() => rows("select public.accept_invitation()"));
    await login(owner);
    await rows("select public.prepare_client_deletion($1,$2)", [c1, "One"]);
    await assert.rejects(() =>
      rows("select public.client_invitation_account($1)", [c1]),
    );
    await rows("select public.finish_client_deletion($1)", [c1]);
    await db.exec("reset role");
    assert.equal((await rows("select * from auth.users")).length, 4);
    assert.equal((await rows("select * from public.clients")).length, 1);
    assert.equal(
      (await rows("select * from public.invitations where client_id=$1", [c1]))
        .length,
      0,
    );
  } finally {
    await db.close();
  }
});
