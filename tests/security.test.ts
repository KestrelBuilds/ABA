import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createStages } from "../lib/projects";
const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  one: "00000000-0000-4000-8000-000000000002",
  two: "00000000-0000-4000-8000-000000000003",
  stranger: "00000000-0000-4000-8000-000000000004",
  c1: "10000000-0000-4000-8000-000000000001",
  c2: "10000000-0000-4000-8000-000000000002",
  p1: "20000000-0000-4000-8000-000000000001",
  p2: "20000000-0000-4000-8000-000000000002",
  d1: "30000000-0000-4000-8000-000000000001",
  d2: "30000000-0000-4000-8000-000000000002",
  draft: "30000000-0000-4000-8000-000000000003",
  final: "30000000-0000-4000-8000-000000000004",
};
test("PostgreSQL policies enforce client isolation, protected writes, questionnaires, documents, storage and audit", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated;`);
    await db.exec(
      `create table auth.mfa_factors(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),status text); create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal1')) $$;`,
    );
    // PGlite has core gen_random_uuid(); pgcrypto extension registration is Supabase-specific.
    await db.exec(
      (
        await readFile("supabase/migrations/202610270001_workspace.sql", "utf8")
      ).replace("create extension if not exists pgcrypto;", ""),
    );
    await db.exec(
      await readFile("supabase/migrations/202610270002_storage.sql", "utf8"),
    );
    await db.exec(
      await readFile("supabase/migrations/202610270003_owner_mfa.sql", "utf8"),
    );
    await db.exec(`insert into auth.users(id) values('${ids.admin}'),('${ids.one}'),('${ids.two}'),('${ids.stranger}');
 insert into public.clients(id,name,contact,email) values('${ids.c1}','Client one','One','one@example.com'),('${ids.c2}','Client two','Two','two@example.com');
 insert into public.profiles values('${ids.admin}','admin',null),('${ids.one}','client','${ids.c1}'),('${ids.two}','client','${ids.c2}');
 insert into public.projects(id,client_id,name,type,due,budget,contract_signed,deposit_paid) values('${ids.p1}','${ids.c1}','Brand project','Brand Identity','2027-01-01',3000,true,true),('${ids.p2}','${ids.c2}','Website project','Website Design','2027-02-01',4000,true,true);
 insert into public.project_notes values('${ids.p1}','PRIVATE COSTS AND NOTES'),('${ids.p2}','OTHER PRIVATE NOTES');
 insert into public.stages(project_id,name,stream,position,visible) values('${ids.p1}','Visible milestone','Brand Identity',0,true),('${ids.p1}','INTERNAL milestone','Brand Identity',1,false),('${ids.p2}','Website milestone','Website Design',0,true);
 insert into public.documents(id,project_id,name,object_path,category,published) values('${ids.d1}','${ids.p1}','Presentation','${ids.p1}/${ids.d1}','presentation',true),('${ids.d2}','${ids.p2}','Website PDF','${ids.p2}/${ids.d2}','document',true),('${ids.draft}','${ids.p1}','Unpublished','${ids.p1}/${ids.draft}','document',false),('${ids.final}','${ids.p1}','Final files','${ids.p1}/${ids.final}','final',true);
 insert into storage.objects(bucket_id,name) select 'project-files',object_path from public.documents;`);
    const asUser = async (id: string) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    };
    const rows = async (sql: string) =>
      (await db.query<Record<string, unknown>>(sql)).rows;
    await asUser(ids.one);
    assert.equal((await rows("select * from public.clients")).length, 1);
    assert.equal((await rows("select * from public.projects")).length, 1);
    assert.equal((await rows("select * from public.project_notes")).length, 0);
    assert.equal((await rows("select * from public.stages")).length, 1);
    assert.equal((await rows("select * from public.documents")).length, 1);
    assert.equal((await rows("select * from storage.objects")).length, 1);
    assert.equal((await rows("select * from public.audit_events")).length, 0);
    await assert.rejects(() =>
      db.exec(`update public.profiles set role='admin' where id='${ids.one}'`),
    );
    await db.exec(
      `update public.projects set final_paid=true where id='${ids.p1}'`,
    );
    assert.equal(
      (await rows("select final_paid from public.projects"))[0].final_paid,
      false,
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.feedback(document_id,author_id,body,decision) values('${ids.d2}','${ids.one}','Cross-client approval','approved')`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.feedback(document_id,author_id,body,decision) values('${ids.d1}','${ids.two}','Spoofed author','approved')`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.questionnaires(project_id,kind,answers,submitted_by) values('${ids.p1}','website','{"goals":"Wrong workflow"}','${ids.one}')`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `insert into storage.objects(bucket_id,name) values('project-files','${ids.p1}/evil.pdf')`,
      ),
    );
    await db.exec(
      `insert into public.questionnaires(project_id,kind,answers,submitted_by) values('${ids.p1}','brand','{"business":"Fictional identity"}','${ids.one}'); insert into public.feedback(document_id,author_id,body,decision) values('${ids.d1}','${ids.one}','Please refine the wordmark','changes_requested');`,
    );
    await asUser(ids.two);
    assert.equal((await rows("select * from public.questionnaires")).length, 0);
    assert.equal((await rows("select * from public.feedback")).length, 0);
    assert.equal((await rows("select * from public.projects"))[0].id, ids.p2);
    await asUser(ids.admin);
    assert.equal((await rows("select * from public.projects")).length, 2);
    assert.equal((await rows("select * from public.project_notes")).length, 2);
    assert.equal((await rows("select * from public.documents")).length, 4);
    assert.ok((await rows("select * from public.audit_events")).length > 0);
    // Final files remain locked with payment alone, then release only after verified final approval.
    await db.exec(
      `update public.projects set final_paid=true where id='${ids.p1}'`,
    );
    await asUser(ids.one);
    assert.equal((await rows("select * from public.documents")).length, 1);
    await asUser(ids.admin);
    await db.exec(
      `update public.projects set final_approved=true where id='${ids.p1}'`,
    );
    await asUser(ids.one);
    assert.equal((await rows("select * from public.documents")).length, 2);
    assert.equal((await rows("select * from storage.objects")).length, 2);
    // Revoking onboarding removes all project and document access even with a live session.
    await asUser(ids.admin);
    await db.exec(
      `update public.projects set deposit_paid=false where id='${ids.p1}'`,
    );
    await asUser(ids.one);
    assert.equal((await rows("select * from public.projects")).length, 0);
    assert.equal((await rows("select * from storage.objects")).length, 0);
    // Invite acceptance cannot bypass payment, cannot switch accounts, and cannot escalate roles.
    await asUser(ids.admin);
    await db.exec(
      `insert into public.invitations(client_id,user_id) values('${ids.c1}','${ids.stranger}')`,
    );
    await asUser(ids.stranger);
    await assert.rejects(() => db.exec("select public.accept_invitation()"));
    await asUser(ids.admin);
    await db.exec(
      `update public.projects set deposit_paid=true where id='${ids.p1}'`,
    );
    await asUser(ids.stranger);
    await db.exec("select public.accept_invitation()");
    assert.equal(
      (await rows("select role from public.profiles"))[0].role,
      "client",
    );
    await db.exec("select public.accept_invitation()"); // Idempotent retry.
    assert.equal((await rows("select * from public.projects")).length, 1);
    await assert.rejects(() =>
      db.exec(`select public.revoke_client_access('${ids.c2}')`),
    );
    await asUser(ids.admin);
    await db.exec(
      `select public.move_stage((select id from public.stages where name='Visible milestone'),1)`,
    );
    assert.equal(
      (
        await rows(
          "select position from public.stages where name='Visible milestone'",
        )
      )[0].position,
      1,
    );
    await db.exec(`select public.revoke_client_access('${ids.c1}')`);
    await asUser(ids.one);
    assert.equal((await rows("select * from public.projects")).length, 0);
    await asUser(ids.stranger);
    assert.equal((await rows("select * from public.projects")).length, 0);
    assert.equal((await rows("select * from public.clients")).length, 0);
    await asUser(ids.admin);
    const created = await db.query<{ id: string }>(
      `select public.create_project($1,$2,$3,$4,$5,$6::jsonb) as id`,
      [
        "Combined test",
        ids.c2,
        "Both",
        "2027-03-01",
        5000,
        JSON.stringify(
          createStages("Both").map((s) => ({ name: s.name, stream: s.stream })),
        ),
      ],
    );
    const createdId = created.rows[0].id;
    assert.equal(
      (
        await rows(
          `select * from public.stages where project_id='${createdId}'`,
        )
      ).length,
      25,
    );
    await db.query(
      `select public.save_project_controls($1,true,true,false,false,$2)`,
      [createdId, "Internal note, never a client DTO"],
    );
    assert.equal(
      (
        await rows(
          `select body from public.project_notes where project_id='${createdId}'`,
        )
      )[0].body,
      "Internal note, never a client DTO",
    );
    await asUser(ids.two);
    assert.equal((await rows("select * from public.project_notes")).length, 0);
    await assert.rejects(() =>
      db.query(
        `select public.save_project_controls($1,true,true,true,true,$2)`,
        [createdId, "Forged"],
      ),
    );
    await asUser(ids.admin);
    assert.equal(
      (await rows("select public.owner_mfa_ready() as ready"))[0].ready,
      true,
    );
    await db.exec("reset role");
    await db.exec(
      `insert into auth.mfa_factors(user_id,status) values('${ids.admin}','verified')`,
    );
    await asUser(ids.admin);
    assert.equal(
      (await rows("select public.is_admin() as allowed"))[0].allowed,
      false,
    );
    assert.equal((await rows("select * from public.projects")).length, 0);
    assert.equal((await rows("select * from public.project_notes")).length, 0);
    assert.equal((await rows("select * from storage.objects")).length, 0);
    await assert.rejects(() =>
      db.exec(`select public.revoke_client_access('${ids.c2}')`),
    );
    await db.exec("select set_config('request.jwt.claim.aal','aal2',false)");
    assert.equal(
      (await rows("select public.is_admin() as allowed"))[0].allowed,
      true,
    );
    assert.ok((await rows("select * from public.projects")).length > 0);
    await db.exec("select set_config('request.jwt.claim.aal','aal1',false)");
    await asUser(ids.two);
    assert.equal(
      (await rows("select public.owner_mfa_ready() as ready"))[0].ready,
      false,
    );
    assert.ok((await rows("select * from public.projects")).length > 0);
    await db.exec("reset role;set role anon");
    await assert.rejects(() => db.exec("select * from public.projects"));
  } finally {
    await db.close();
  }
});
