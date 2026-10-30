import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { newProjectStages } from "../lib/workflow-templates";

test("stage-purpose upgrade preserves records and access, maps only unambiguous stages and enforces owner writes", async () => {
  const db = new PGlite();
  const owner = randomUUID(),
    client = randomUUID(),
    other = randomUUID(),
    cid = randomUUID(),
    pid = randomUUID(),
    duplicate = randomUUID(),
    overlap = randomUUID();
  const rows = async (sql: string) =>
    (await db.query<Record<string, any>>(sql)).rows;
  const as = async (id: string) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  };
  const apply = async (file: string) =>
    db.exec(
      (await readFile("supabase/migrations/" + file, "utf8")).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
  try {
    await db.exec(
      `create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create table auth.mfa_factors(id uuid primary key,user_id uuid,status text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select '{"aal":"aal1"}'::jsonb$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;`,
    );
    for (const file of (await readdir("supabase/migrations"))
      .filter(
        (f) => f.endsWith(".sql") && f < "202610300011_stage_purposes.sql",
      )
      .sort())
      await apply(file);
    await db.exec(
      `insert into auth.users(id) values('${owner}'),('${client}'),('${other}');insert into public.clients(id,name,contact,email) values('${cid}','Fictional','Fictional','test@example.com');insert into public.profiles values('${owner}','admin',null),('${client}','client','${cid}');insert into public.projects(id,client_id,name,type,due,budget,contract_signed,final_approved) values('${pid}','${cid}','Main','Both','2027-01-01',100,true,true),('${duplicate}','${cid}','Duplicate','Both','2027-01-01',100,true,true),('${overlap}','${cid}','Overlap','Both','2027-01-01',100,true,true);`,
    );
    for (const [project, name, stream] of [
      [pid, "Contract", "Onboarding"],
      [pid, "Invoice", "Onboarding"],
      [pid, "Final Approval", "Brand Identity"],
      [pid, "Final Review and Approval", "Website Design"],
      [pid, "Final Invoice", "Website Design"],
      [pid, "Signed contract PDF uploaded", "Custom"],
      [pid, "Internal", "Custom"],
      [duplicate, "Contract", "Onboarding"],
      [duplicate, " contract ", "Onboarding"],
      [duplicate, "Final Approval", "Brand Identity"],
      [duplicate, "Final Review and Approval", "Brand Identity"],
      [overlap, "Contract and Deposit", "Onboarding"],
      [overlap, "Invoice", "Onboarding"],
    ])
      await db.query(
        "insert into public.stages(project_id,name,stream,position,status,visible) values($1,$2,$3,0,'Completed',$4)",
        [project, name, stream, name !== "Internal"],
      );
    const beforeProjects = await rows(
      "select * from public.projects order by id",
    );
    const beforeStages = await rows("select * from public.stages order by id");
    await as(client);
    const accessBefore = await rows(
      `select public.can_access_project('${pid}') as allowed`,
    );
    await db.exec("reset role");
    await apply("202610300011_stage_purposes.sql");
    assert.deepEqual(
      await rows("select * from public.projects order by id"),
      beforeProjects,
    );
    const after = await rows("select * from public.stages order by id");
    assert.deepEqual(
      after.map(({ purpose, ...s }) => s),
      beforeStages,
    );
    const find = (name: string) =>
      after.find((s) => s.project_id === pid && s.name === name)!.purpose;
    assert.equal(find("Contract"), "contract");
    assert.equal(find("Invoice"), "deposit");
    assert.equal(find("Final Approval"), "final_approval");
    assert.equal(find("Final Review and Approval"), "final_approval");
    assert.equal(find("Final Invoice"), "final_payment");
    assert.equal(find("Signed contract PDF uploaded"), null);
    assert.ok(
      after
        .filter((s) => s.project_id !== pid)
        .every((s) => s.purpose === null),
    );
    await as(owner);
    assert.equal(
      (await rows("select public.stage_purposes_ready() as ready"))[0].ready,
      true,
    );
    const contract = after.find(
      (s) => s.project_id === pid && s.name === "Contract",
    )!;
    await db.query(
      "update public.stages set name='Agreement review' where id=$1",
      [contract.id],
    );
    assert.equal(
      (
        await rows(
          `select purpose from public.stages where id='${contract.id}'`,
        )
      )[0].purpose,
      "contract",
    );
    await db.query(
      "update public.stages set purpose='final_payment' where id=$1",
      [contract.id],
    );
    assert.deepEqual(
      await rows("select * from public.projects order by id"),
      beforeProjects,
    );
    await assert.rejects(() =>
      db.query(
        "update public.stages set purpose='signature_guessed' where id=$1",
        [contract.id],
      ),
    );
    const created = (
      await db.query<{ id: string }>(
        "select public.create_project($1,$2,$3,$4,$5,$6::jsonb) as id",
        [
          "New",
          cid,
          "Both",
          "2027-01-01",
          100,
          JSON.stringify(newProjectStages("Both")),
        ],
      )
    ).rows[0].id;
    const fresh = await rows(
      `select name,purpose from public.stages where project_id='${created}' order by position`,
    );
    assert.equal(fresh.find((s) => s.name === "Contract")!.purpose, "contract");
    assert.equal(fresh.find((s) => s.name === "Invoice")!.purpose, "deposit");
    assert.equal(fresh.filter((s) => s.purpose === "progress").length, 14);
    // New app templates also work on older schemas (tested by the existing suites).
    const legacy = (
      await db.query<{ id: string }>(
        "select public.create_project($1,$2,$3,$4,$5,$6::jsonb) as id",
        [
          "Old app",
          cid,
          "Brand Identity",
          "2027-01-01",
          100,
          JSON.stringify([{ name: "Contract", stream: "Onboarding" }]),
        ],
      )
    ).rows[0].id;
    assert.equal(
      (
        await rows(
          `select purpose from public.stages where project_id='${legacy}'`,
        )
      )[0].purpose,
      null,
    );
    await as(client);
    assert.deepEqual(
      await rows(`select public.can_access_project('${pid}') as allowed`),
      accessBefore,
    );
    assert.deepEqual(
      await rows(
        `update public.stages set purpose='progress' where id='${contract.id}' returning id`,
      ),
      [],
    );
    await assert.rejects(() =>
      db.query("select public.create_project($1,$2,$3,$4,$5,$6::jsonb)", [
        "Forbidden",
        cid,
        "Both",
        "2027-01-01",
        100,
        "[]",
      ]),
    );
    // Even after full access is verified, stage purposes do not grant client writes
    // or reveal internal stages.
    await as(owner);
    await db.exec(
      `update public.projects set deposit_paid=true where id='${pid}'`,
    );
    await as(client);
    assert.equal(
      (
        await rows(
          `select purpose from public.stages where id='${contract.id}'`,
        )
      )[0].purpose,
      "final_payment",
    );
    assert.deepEqual(
      await rows(
        `update public.stages set purpose='progress' where id='${contract.id}' returning id`,
      ),
      [],
    );
    assert.equal(
      (
        await rows(
          `select * from public.stages where project_id='${pid}' and name='Internal'`,
        )
      ).length,
      0,
    );
  } finally {
    await db.close();
  }
});
