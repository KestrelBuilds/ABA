import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
test("client deletion freezes/revokes access, checks storage cleanup, preserves other clients, financial history and audit", async () => {
  const db = new PGlite();
  const [
    owner,
    client,
    other,
    c1,
    c2,
    p1,
    p2,
    stage,
    document,
    asset,
    orphan,
    otherDoc,
    empty,
  ] = Array.from({ length: 14 }, () => randomUUID());
  const rows = async (sql: string) =>
    (await db.query<Record<string, any>>(sql)).rows;
  const as = async (id: string) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  };
  try {
    await db.exec(
      `create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);create table auth.mfa_factors(id uuid primary key,user_id uuid,status text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(current_setting('request.jwt.claim.aal',true),'aal1'))$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;`,
    );
    for (const file of [
      "202610270001_workspace.sql",
      "202610270002_storage.sql",
      "202610270003_owner_mfa.sql",
      "202610280004_project_management.sql",
      "202610280005_business_documents.sql",
      "202610280006_contract_area.sql",
      "202610280007_client_deletion.sql",
    ])
      await db.exec(
        (await readFile("supabase/migrations/" + file, "utf8")).replace(
          "create extension if not exists pgcrypto;",
          "",
        ),
      );
    await db.exec(
      `insert into auth.users values('${owner}'),('${client}'),('${other}');insert into public.clients(id,name,contact,email)values('${c1}','Test client','Jamie','test@example.com'),('${c2}','Keep client','Robin','keep@example.com'),('${empty}','Empty client','Empty','empty@example.com');insert into public.profiles values('${owner}','admin',null),('${client}','client','${c1}'),('${other}','client','${c2}');insert into public.projects(id,client_id,name,type,due,budget)values('${p1}','${c1}','Delete project','Brand Identity','2027-01-01',1000),('${p2}','${c2}','Keep project','Website Design','2027-01-01',1000);insert into public.stages(id,project_id,name,stream,position,visible)values('${stage}','${p1}','Contract','Onboarding',0,true);insert into public.documents(id,project_id,stage_id,name,object_path,document_role,category,published)values('${document}','${p1}','${stage}','Contract.pdf','${p1}/${document}','Contract','document',true),('${otherDoc}','${p2}',null,'Keep.pdf','${p2}/${otherDoc}','General','document',true);insert into public.contract_exchanges values('${p1}','${stage}',true);insert into public.client_assets(id,project_id,stage_id,contract_document_id,uploader_id,name,object_path)values('${asset}','${p1}','${stage}','${document}','${client}','Signed.pdf','${p1}/${asset}');insert into storage.objects(bucket_id,name)values('project-files','${p1}/${document}'),('client-assets','${p1}/${asset}'),('client-assets','${p1}/${orphan}'),('project-files','${p2}/${otherDoc}');insert into public.invitations(client_id,user_id)values('${c1}','${client}');insert into public.project_notes values('${p1}','Private notes');insert into public.project_details(project_id)values('${p1}');insert into public.project_handover values('${p1}','Handover');insert into public.client_actions(project_id,title)values('${p1}','Return files');insert into public.stage_resources(stage_id)values('${stage}');insert into public.questionnaires(project_id,kind,answers,submitted_by)values('${p1}','brand','{}','${client}');insert into public.feedback(document_id,author_id,body,decision)values('${document}','${client}','Comment','comment');insert into public.client_billing values('${c1}','Test billing','Test address');`,
    );
    await as(client);
    assert.equal(
      (
        await rows(`select public.client_storage_writable('${p2}') as allowed`)
      )[0].allowed,
      false,
    );
    assert.equal((await rows("select * from public.documents")).length, 1);
    assert.equal(
      (await rows("select * from public.client_deletions")).length,
      0,
    );
    await assert.rejects(() =>
      db.exec(`select public.prepare_client_deletion('${c1}','Test client')`),
    );
    await assert.rejects(() =>
      db.exec(`select public.finish_client_deletion('${c1}')`),
    );
    await as(owner);
    await assert.rejects(() =>
      db.exec(`select public.prepare_client_deletion('${c1}','Wrong name')`),
    );
    assert.equal(
      (
        await rows(
          `select deletion_pending from public.clients where id='${c1}'`,
        )
      )[0].deletion_pending,
      false,
    );
    const plan = (
      await rows(
        `select public.prepare_client_deletion('${c1}','Test client') as plan`,
      )
    )[0].plan;
    assert.equal(plan.client_id, c1);
    assert.deepEqual(plan.project_ids, [p1]);
    assert.equal(plan.files.length, 3);
    assert.ok(plan.files.every((f: any) => f.path.startsWith(p1 + "/")));
    await assert.rejects(() =>
      db.exec(`select public.finish_client_deletion('${c1}')`),
    );
    await assert.rejects(() =>
      db.exec(`update public.clients set name='Changed' where id='${c1}'`),
    );
    await assert.rejects(() =>
      db.exec(`update public.projects set client_id='${c2}' where id='${p1}'`),
    );
    await assert.rejects(() =>
      db.exec(
        `update public.documents set published=false where id='${document}'`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `insert into storage.objects(bucket_id,name)values('project-files','${p1}/${document}')`,
      ),
    );
    await assert.rejects(() =>
      db.exec(`select public.new_proposal('${p1}',null)`),
    );
    await as(client);
    assert.equal((await rows("select * from public.documents")).length, 0);
    assert.equal((await rows("select * from storage.objects")).length, 0);
    assert.equal(
      (await rows("select public.contract_area() as area"))[0].area.length,
      0,
    );
    await as(owner);
    await db.exec(
      `delete from storage.objects where bucket_id='project-files' and name='${p1}/${document}'`,
    );
    const resumed = (
      await rows(
        `select public.prepare_client_deletion('${c1}','Test client') as plan`,
      )
    )[0].plan;
    assert.equal(resumed.files.length, 2);
    assert.equal(
      (await rows(`select * from public.documents where id='${document}'`))
        .length,
      1,
    );
    await db.exec(
      `delete from storage.objects where bucket_id='client-assets' and name in ('${p1}/${asset}','${p1}/${orphan}')`,
    );
    await db.exec(`select public.finish_client_deletion('${c1}')`);
    assert.equal(
      (await rows(`select * from public.clients where id='${c1}'`)).length,
      0,
    );
    assert.equal(
      (await rows(`select * from public.projects where id='${p1}'`)).length,
      0,
    );
    assert.equal(
      (await rows(`select * from public.documents where id='${document}'`))
        .length,
      0,
    );
    assert.equal(
      (await rows(`select * from public.client_assets where id='${asset}'`))
        .length,
      0,
    );
    assert.equal(
      (await rows("select * from public.contract_exchanges")).length,
      0,
    );
    assert.equal(
      (await rows("select * from public.client_deletions")).length,
      0,
    );
    assert.equal(
      (await rows(`select * from public.documents where id='${otherDoc}'`))
        .length,
      1,
    );
    assert.equal((await rows("select * from storage.objects")).length, 1);
    assert.ok(
      (
        await rows(
          `select * from public.audit_events where entity_id='${c1}' and action='deleted'`,
        )
      ).length === 1,
    );
    assert.equal(
      (await rows(`select * from public.profiles where id='${other}'`)).length,
      1,
    );
    await db.exec("reset role");
    assert.equal(
      (await rows(`select * from auth.users where id='${client}'`)).length,
      1,
    );
    await as(owner);
    await db.exec(`select public.finish_client_deletion('${c1}')`);
    await db.exec(`select public.new_proposal('${p2}',null)`);
    await assert.rejects(
      () =>
        db.exec(`select public.prepare_client_deletion('${c2}','Keep client')`),
      /financial records/,
    );
    assert.equal(
      (
        await rows(
          `select deletion_pending from public.clients where id='${c2}'`,
        )
      )[0].deletion_pending,
      false,
    );
    assert.equal(
      (await rows(`select * from public.profiles where id='${other}'`)).length,
      1,
    );
    await db.exec("reset role");
    await db.exec(
      `insert into auth.mfa_factors values('${randomUUID()}','${owner}','verified')`,
    );
    await as(owner);
    await assert.rejects(() =>
      db.exec(
        `select public.prepare_client_deletion('${empty}','Empty client')`,
      ),
    );
    await db.exec("select set_config('request.jwt.claim.aal','aal2',false)");
    await db.exec(
      `select public.prepare_client_deletion('${empty}','Empty client');select public.finish_client_deletion('${empty}')`,
    );
    assert.equal(
      (await rows(`select * from public.clients where id='${empty}'`)).length,
      0,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(() =>
      db.exec(`select public.prepare_client_deletion('${c2}','Keep client')`),
    );
  } finally {
    await db.close();
  }
});
