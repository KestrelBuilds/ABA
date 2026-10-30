import { test } from "node:test";
import assert from "node:assert/strict";
import { splitPayment, financeTotals } from "../lib/finance/money";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const owner = "00000000-0000-4000-8000-000000000001",
  one = "00000000-0000-4000-8000-000000000002",
  two = "00000000-0000-4000-8000-000000000003",
  c1 = "10000000-0000-4000-8000-000000000001",
  c2 = "10000000-0000-4000-8000-000000000002",
  project = "20000000-0000-4000-8000-000000000001";
test("money splits conserve every penny and finance excludes drafts/voids", () => {
  assert.deepEqual(splitPayment(10101), { deposit: 5051, final: 5050 });
  assert.throws(() => splitPayment(1.5));
  assert.deepEqual(
    financeTotals(
      [
        { status: "Draft", amount_pence: 100, paid_on: null },
        { status: "Void", amount_pence: 200, paid_on: null },
        { status: "Issued", amount_pence: 300, paid_on: null },
        { status: "Paid", amount_pence: 400, paid_on: "2026-10-28" },
        { status: "Paid", amount_pence: 500, paid_on: "2026-09-28" },
      ],
      "2026-10",
    ),
    { outstanding: 300, received: 900, monthly: 400 },
  );
});
test("finance SQL enforces immutable snapshots, private drafts, 50/50 invoices and verified payment gates", async () => {
  const db = new PGlite();
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
      "202610280007_client_deletion.sql",
      "202610300011_stage_purposes.sql",
    ])
      await db.exec(
        (await readFile("supabase/migrations/" + file, "utf8")).replace(
          "create extension if not exists pgcrypto;",
          "",
        ),
      );
    await db.exec(
      `insert into auth.users values('${owner}'),('${one}'),('${two}');insert into public.clients(id,name,contact,email)values('${c1}','One business','One','one@example.com'),('${c2}','Two business','Two','two@example.com');insert into public.profiles values('${owner}','admin',null),('${one}','client','${c1}'),('${two}','client','${c2}');insert into public.projects(id,client_id,name,type,due,budget,contract_signed)values('${project}','${c1}','Test brand','Brand Identity','2027-01-01',101.01,true);`,
    );
    const as = async (user: string) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user,
      ]);
      await db.exec("set role authenticated");
    };
    const rows = async (sql: string) =>
      (await db.query<Record<string, unknown>>(sql)).rows;
    await as(owner);
    const p = (
      await rows(`select public.new_proposal('${project}',null) as id`)
    )[0].id;
    await db.query("select public.save_proposal($1,$2,$3,$4,$5,$6,$7)", [
      p,
      "Brand identity",
      "Logo and guidelines",
      "Four weeks",
      "Two rounds",
      "Printing",
      "Creative work only",
    ]);
    await db.exec(`select public.change_proposal_status('${p}','Shared')`);
    await assert.rejects(() =>
      db.exec(`select public.save_proposal('${p}','changed','','','','','')`),
    );
    await db.exec(`select public.change_proposal_status('${p}','Accepted')`);
    await db.exec(`select public.create_invoice_pair('${project}')`);
    const invoices = await rows("select * from public.invoices order by kind");
    assert.deepEqual(
      invoices.map((i) => Number(i.amount_pence)),
      [5051, 5050],
    );
    await assert.rejects(() =>
      db.exec(`select public.create_invoice_pair('${project}')`),
    );
    const deposit = String(invoices[0].id),
      final = String(invoices[1].id);
    await assert.rejects(() =>
      db.exec(
        `select public.issue_invoice('${deposit}',current_date,current_date)`,
      ),
    );
    await db.exec(
      `insert into public.finance_settings(id,seller_name,seller_address,seller_email,payment_instructions,no_vat_confirmed)values(true,'Alex Bell trading as Alex Bell Arts','Fictional seller address','owner@example.com','Pay by agreed method',true);insert into public.client_billing values('${c1}','One billing','Fictional billing address');select public.issue_invoice('${deposit}',current_date,current_date);`,
    );
    await assert.rejects(() =>
      db.exec(
        `update public.invoices set amount_pence=1 where id='${deposit}'`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `update public.projects set deposit_paid=true where id='${project}'`,
      ),
    );
    await assert.rejects(() =>
      db.exec(`update public.projects set budget=500 where id='${project}'`),
    );
    await as(one);
    assert.equal((await rows("select * from public.invoices")).length, 0);
    await assert.rejects(() =>
      db.exec(
        `select public.record_invoice_payment('${deposit}',current_date)`,
      ),
    );
    await assert.rejects(() =>
      db.exec(`select public.new_proposal('${project}',null)`),
    );
    await as(owner);
    await db.exec(
      `select public.record_invoice_payment('${deposit}',current_date)`,
    );
    assert.equal(
      (await rows("select deposit_paid from public.projects"))[0].deposit_paid,
      true,
    );
    await assert.rejects(() =>
      db.exec(`select public.void_invoice('${deposit}')`),
    );
    await as(one);
    assert.equal((await rows("select * from public.invoices")).length, 1);
    assert.equal((await rows("select * from public.proposals")).length, 1);
    await db.exec(
      `update public.projects set final_paid=true where id='${project}'`,
    );
    await as(two);
    assert.equal((await rows("select * from public.invoices")).length, 0);
    assert.equal((await rows("select * from public.proposals")).length, 0);
    assert.equal(
      (await rows("select * from public.finance_settings")).length,
      0,
    );
    await as(owner);
    assert.equal(
      (await rows("select final_paid from public.projects"))[0].final_paid,
      false,
    );
    await assert.rejects(() =>
      db.exec(
        `select public.issue_invoice('${final}',current_date,current_date)`,
      ),
    );
    await db.exec(
      `update public.projects set final_approved=true where id='${project}';select public.issue_invoice('${final}',current_date,current_date);update public.finance_settings set seller_address='New seller address';`,
    );
    assert.equal(
      (
        (
          await rows(
            `select seller_snapshot from public.invoices where id='${deposit}'`,
          )
        )[0].seller_snapshot as { address: string }
      ).address,
      "Fictional seller address",
    );
    await db.exec(`select public.void_invoice('${final}')`);
    const replacement = (
      await rows(`select public.replace_void_invoice('${final}') as id`)
    )[0].id;
    await db.exec(
      `select public.issue_invoice('${replacement}',current_date,current_date);select public.record_invoice_payment('${replacement}',current_date)`,
    );
    assert.equal(
      (await rows("select final_paid from public.projects"))[0].final_paid,
      true,
    );
    assert.equal(
      new Set(
        (
          await rows(
            "select number from public.invoices where number is not null",
          )
        ).map((i) => i.number),
      ).size,
      3,
    );

    const visibleStage = "60000000-0000-4000-8000-000000000001",
      hiddenStage = "60000000-0000-4000-8000-000000000002",
      stageDoc = "70000000-0000-4000-8000-000000000001";
    await db.exec(
      `insert into public.stages(id,project_id,name,stream,position,visible) values('${visibleStage}','${project}','Discovery Call','Onboarding',0,true),('${hiddenStage}','${project}','Internal proposal','Onboarding',1,false);insert into public.stage_resources(stage_id,instructions,booking_url)values('${visibleStage}','Book and review','https://calendly.com/alex-bell-arts/new-meeting'),('${hiddenStage}','Hidden instructions','');insert into public.documents(id,project_id,name,object_path,category,published,stage_id,document_role)values('${stageDoc}','${project}','Private proposal PDF','${project}/${stageDoc}','document',true,'${hiddenStage}','Proposal');`,
    );
    await as(one);
    assert.equal(
      (await rows("select * from public.stage_resources")).length,
      1,
    );
    assert.equal(
      (await rows(`select * from public.documents where id='${stageDoc}'`))
        .length,
      0,
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.client_assets(project_id,uploader_id,name,object_path,stage_id)values('${project}','${one}','Hidden return','${project}/00000000-0000-4000-8000-000000000999','${hiddenStage}')`,
      ),
    );
    await as(owner);
    await assert.rejects(() =>
      db.exec(`delete from public.stages where id='${hiddenStage}'`),
    );
    await db.exec(
      `update public.documents set stage_id='${visibleStage}' where id='${stageDoc}'`,
    );
    await as(one);
    assert.equal(
      (await rows(`select * from public.documents where id='${stageDoc}'`))
        .length,
      1,
    );
  } finally {
    await db.close();
  }
});
