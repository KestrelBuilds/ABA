import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
test("contract-only SQL isolates early invitations, signed returns, storage and full-portal gates", async () => {
  const db = new PGlite();
  const owner = randomUUID(),
    client = randomUUID(),
    other = randomUUID(),
    c1 = randomUUID(),
    c2 = randomUUID(),
    p1 = randomUUID(),
    p2 = randomUUID(),
    stage = randomUUID(),
    hidden = randomUUID(),
    otherStage = randomUUID();
  const contract = randomUUID(),
    proposal = randomUUID(),
    invoice = randomUUID(),
    final = randomUUID(),
    draft = randomUUID(),
    hiddenDoc = randomUUID(),
    foreign = randomUUID(),
    asset = randomUUID();
  const rows = async (sql: string) =>
    (await db.query<Record<string, any>>(sql)).rows;
  const as = async (id: string) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  };
  try {
    await db.exec(
      `create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);create table auth.mfa_factors(id uuid primary key,user_id uuid,status text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select '{"aal":"aal1"}'::jsonb$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;`,
    );
    for (const file of [
      "202610270001_workspace.sql",
      "202610270002_storage.sql",
      "202610270003_owner_mfa.sql",
      "202610280004_project_management.sql",
      "202610280005_business_documents.sql",
      "202610280006_contract_area.sql",
    ])
      await db.exec(
        (await readFile("supabase/migrations/" + file, "utf8")).replace(
          "create extension if not exists pgcrypto;",
          "",
        ),
      );
    await db.exec(
      `insert into auth.users values('${owner}'),('${client}'),('${other}');insert into public.clients(id,name,contact,email)values('${c1}','One','Jamie','one@example.com'),('${c2}','Two','Robin','two@example.com');insert into public.profiles values('${owner}','admin',null),('${other}','client','${c2}');insert into public.projects(id,client_id,name,type,due,budget)values('${p1}','${c1}','Contract project','Brand Identity','2027-01-01',1000),('${p2}','${c2}','Other project','Website Design','2027-01-01',1000);insert into public.stages(id,project_id,name,stream,position,visible)values('${stage}','${p1}','Custom agreement stage','Onboarding',0,true),('${hidden}','${p1}','Internal','Onboarding',1,false),('${otherStage}','${p2}','Other contract','Onboarding',0,true);insert into public.project_notes values('${p1}','SECRET NOTES');insert into public.project_details(project_id,goal) values('${p1}','PRIVATE BRIEF');insert into public.project_handover values('${p1}','PRIVATE HANDOVER');insert into public.client_actions(project_id,title)values('${p1}','Private action');insert into public.invitations(client_id,user_id)values('${c1}','${client}');`,
    );
    for (const [id, projectId, stageId, role, category, published] of [
      [contract, p1, stage, "Contract", "document", true],
      [proposal, p1, stage, "Proposal", "document", true],
      [invoice, p1, stage, "Invoice", "document", true],
      [final, p1, stage, "Contract", "final", true],
      [draft, p1, stage, "Contract", "document", false],
      [hiddenDoc, p1, hidden, "Contract", "document", true],
      [foreign, p2, otherStage, "Contract", "document", true],
    ])
      await db.query(
        "insert into public.documents(id,project_id,stage_id,name,object_path,document_role,category,published)values($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          projectId,
          stageId,
          "Contract.pdf",
          projectId + "/" + id,
          role,
          category,
          published,
        ],
      );
    await db.exec(
      "insert into storage.objects(bucket_id,name)select 'project-files',object_path from public.documents",
    );
    await as(owner);
    assert.equal(
      (await rows(`select public.client_invitation_ready('${c1}') as ok`))[0]
        .ok,
      false,
    );
    await as(client);
    await assert.rejects(() => db.exec("select public.accept_invitation()"));
    await as(owner);
    await db.exec(
      `insert into public.contract_exchanges values('${p1}','${stage}',true);insert into public.contract_exchanges values('${p2}','${otherStage}',true);`,
    );
    assert.equal(
      (await rows(`select public.client_invitation_ready('${c1}') as ok`))[0]
        .ok,
      true,
    );
    await as(client);
    await db.exec("select public.accept_invitation()");
    assert.deepEqual(
      (await rows("select id from public.documents")).map((r) => r.id),
      [contract],
    );
    assert.deepEqual(
      (await rows("select name from storage.objects")).map((r) => r.name),
      [p1 + "/" + contract],
    );
    for (const table of [
      "projects",
      "stages",
      "project_notes",
      "project_details",
      "project_handover",
      "questionnaires",
      "client_actions",
      "stage_resources",
      "invoices",
      "proposals",
      "feedback",
      "contract_exchanges",
    ])
      assert.equal(
        (await rows("select * from public." + table)).length,
        0,
        table + " must stay closed",
      );
    const area = (await rows("select public.contract_area() as area"))[0].area;
    assert.equal(area.length, 1);
    assert.equal(area[0].name, "Contract project");
    assert.deepEqual(
      area[0].documents.map((d: any) => d.id),
      [contract],
    );
    assert.equal(JSON.stringify(area).includes("SECRET"), false);
    await assert.rejects(() =>
      db.exec(
        `insert into public.feedback(document_id,author_id,body,decision)values('${contract}','${client}','Not a creative approval','approved')`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.questionnaires(project_id,kind,answers,submitted_by)values('${p1}','brand','{}','${client}')`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.client_assets(project_id,stage_id,uploader_id,name,object_path)values('${p1}','${stage}','${client}','No contract link.pdf','${p1}/${randomUUID()}')`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.client_assets(project_id,stage_id,contract_document_id,uploader_id,name,object_path)values('${p1}','${stage}','${foreign}','${client}','Cross client.pdf','${p1}/${randomUUID()}')`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.client_assets(project_id,stage_id,contract_document_id,uploader_id,name,object_path)values('${p1}','${hidden}','${contract}','${client}','Wrong stage.pdf','${p1}/${randomUUID()}')`,
      ),
    );
    await db.exec(
      `insert into public.client_assets(id,project_id,stage_id,contract_document_id,uploader_id,name,object_path)values('${asset}','${p1}','${stage}','${contract}','${client}','Signed contract.pdf','${p1}/${asset}');insert into storage.objects(bucket_id,name)values('client-assets','${p1}/${asset}');`,
    );
    assert.equal((await rows("select * from public.client_assets")).length, 1);
    assert.equal(
      (await rows("select public.contract_area() as area"))[0].area[0]
        .returns[0].contract_document_id,
      contract,
    );
    await db.exec(
      `update public.projects set contract_signed=true,deposit_paid=true where id='${p1}'`,
    );
    assert.equal((await rows("select * from public.projects")).length, 0);
    await as(other);
    assert.equal(
      (await rows(`select * from public.client_assets where id='${asset}'`))
        .length,
      0,
    );
    assert.equal(
      (await rows(`select * from storage.objects where name='${p1}/${asset}'`))
        .length,
      0,
    );
    assert.equal(
      (await rows(`select public.contract_area('${p1}') as area`))[0].area
        .length,
      0,
    );
    await as(owner);
    assert.equal(
      (
        await rows(
          `select contract_signed,deposit_paid from public.projects where id='${p1}'`,
        )
      )[0].contract_signed,
      false,
    );
    await db.exec(
      `update public.documents set published=false where id='${contract}'`,
    );
    await as(client);
    assert.equal((await rows("select * from public.documents")).length, 0);
    assert.equal((await rows("select * from storage.objects")).length, 0);
    await as(owner);
    await db.exec(
      `update public.documents set published=true where id='${contract}';update public.stages set visible=false where id='${stage}'`,
    );
    await as(client);
    assert.equal(
      (await rows("select public.contract_area() as area"))[0].area.length,
      0,
    );
    assert.equal((await rows("select * from storage.objects")).length, 0);
    await as(owner);
    await db.exec(
      `update public.stages set visible=true where id='${stage}';update public.contract_exchanges set enabled=false where project_id='${p1}'`,
    );
    await as(client);
    assert.equal((await rows("select * from public.documents")).length, 0);
    assert.equal((await rows("select * from storage.objects")).length, 0);
    await as(owner);
    await db.exec(
      `update public.contract_exchanges set enabled=true where project_id='${p1}';update public.projects set contract_signed=true where id='${p1}'`,
    );
    await as(client);
    assert.equal((await rows("select * from public.projects")).length, 0);
    await as(owner);
    await db.exec(
      `update public.projects set deposit_paid=true where id='${p1}'`,
    );
    await as(client);
    assert.equal((await rows("select * from public.projects")).length, 1);
    assert.equal((await rows("select * from public.stages")).length, 1);
    assert.equal(
      (await rows(`select * from public.documents where id='${final}'`)).length,
      0,
    );
    assert.equal((await rows("select * from public.project_notes")).length, 0);
    await as(owner);
    await db.exec(`select public.revoke_client_access('${c1}')`);
    await as(client);
    assert.equal((await rows("select * from public.projects")).length, 0);
    assert.equal((await rows("select * from public.documents")).length, 0);
    assert.equal((await rows("select * from public.client_assets")).length, 0);
    assert.equal((await rows("select * from storage.objects")).length, 0);
    assert.equal(
      (await rows("select public.contract_area() as area"))[0].area.length,
      0,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(() => db.exec("select public.contract_area()"));
  } finally {
    await db.close();
  }
});
