import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { workspaceDb, asUser } from "./helpers/workspace-db";
test("quarantine requires an authenticated reservation and trusted matching check; sharing, stage and final gates survive", async () => {
  const db = await workspaceDb();
  const owner = randomUUID(),
    client = randomUUID(),
    stranger = randomUUID(),
    cid = randomUUID(),
    pid = randomUUID(),
    sid = randomUUID(),
    legacy = randomUUID(),
    upload = randomUUID(),
    asset = randomUUID();
  const hash = "a".repeat(64);
  const rows = async (sql: string) => (await db.query<any>(sql)).rows;
  const reserve = async (id: string, kind = "document", category = "final") =>
    db.exec(
      `select public.reserve_file_upload('${pid}','${id}','${kind}','Test.pdf',20,'${hash}','application/pdf','${sid}','${category}')`,
    );
  try {
    await db.exec(
      `insert into auth.users(id)values('${owner}'),('${client}'),('${stranger}');insert into public.clients(id,name,contact,email)values('${cid}','Fictional','Test','test@example.com');insert into public.profiles values('${owner}','admin',null),('${client}','client','${cid}');insert into public.projects(id,client_id,name,type,due,budget,contract_signed,deposit_paid)values('${pid}','${cid}','Files','Brand Identity','2027-01-01',100,true,true);insert into public.stages(id,project_id,name,stream,position)values('${sid}','${pid}','Work','Brand Identity',0);insert into public.documents(id,project_id,name,object_path,category,published)values('${legacy}','${pid}','Old.pdf','${pid}/${legacy}','document',true);insert into storage.objects(bucket_id,name)values('project-files','${pid}/${legacy}');`,
    );
    await db.exec(
      await readFile(
        "supabase/migrations/202610300013_file_security.sql",
        "utf8",
      ),
    );
    assert.equal(
      (
        await rows(
          `select scan_state from public.documents where id='${legacy}'`,
        )
      )[0].scan_state,
      "legacy",
    );
    await asUser(db, owner);
    await reserve(upload);
    assert.equal(
      (
        await rows(
          `select scan_state from public.documents where id='${upload}'`,
        )
      )[0].scan_state,
      "pending",
    );
    await db.exec(
      `insert into storage.objects(bucket_id,name)values('project-files','${pid}/${upload}')`,
    );
    assert.equal(
      (
        await rows(
          `select * from storage.objects where name='${pid}/${upload}'`,
        )
      ).length,
      0,
      "even owner cannot read quarantine bytes",
    );
    await assert.rejects(
      () =>
        db.exec(
          `update public.documents set published=true where id='${upload}'`,
        ),
      /Check this file/,
    );
    await assert.rejects(
      () =>
        db.exec(
          `update public.documents set scan_state='clean' where id='${upload}'`,
        ),
      /Only the upload checker/,
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.documents(project_id,name,object_path)values('${pid}','Fake.pdf','${pid}/'||gen_random_uuid())`,
      ),
    );
    await assert.rejects(
      () =>
        db.exec(
          `select public.complete_file_check('${upload}','clean',20,'${hash}','application/pdf')`,
        ),
      /permission denied/,
    );
    await asUser(db, client);
    assert.equal(
      (await rows(`select * from public.documents where id='${upload}'`))
        .length,
      0,
    );
    await assert.rejects(() => reserve(randomUUID()), /Owner access/);
    await reserve(asset, "asset", "document");
    await asUser(db, stranger);
    await assert.rejects(() => reserve(randomUUID(), "asset"), /not available/);
    await assert.rejects(
      () => db.exec(`select public.file_intake_for_check('${asset}')`),
      /not available/,
    );
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false);set role service_role",
    );
    await assert.rejects(
      () =>
        db.exec(
          `select public.complete_file_check('${upload}','clean',20,'${"b".repeat(64)}','application/pdf')`,
        ),
      /did not match/,
    );
    await db.exec(
      `select public.complete_file_check('${upload}','clean',20,'${hash}','application/pdf');select public.complete_file_check('${asset}','rejected',20,'${hash}','application/pdf')`,
    );
    await asUser(db, owner);
    await db.exec(
      `update public.documents set published=true where id='${upload}'`,
    );
    assert.equal(
      (
        await rows(
          `delete from storage.objects where name='${pid}/${upload}' returning *`,
        )
      ).length,
      0,
      "checked bytes cannot be replaced through upload token replay",
    );
    await asUser(db, client);
    assert.equal(
      (
        await rows(
          `select * from storage.objects where name='${pid}/${upload}'`,
        )
      ).length,
      0,
      "final payment and approval remain required",
    );
    assert.equal(
      (await rows(`select * from public.client_assets where id='${asset}'`))
        .length,
      0,
    );
    await asUser(db, owner);
    await db.exec(
      `update public.projects set final_paid=true,final_approved=true where id='${pid}'`,
    );
    await asUser(db, client);
    assert.equal(
      (
        await rows(
          `select * from storage.objects where name='${pid}/${upload}'`,
        )
      ).length,
      1,
    );
    await asUser(db, owner);
    await db.exec(`update public.stages set visible=false where id='${sid}'`);
    await asUser(db, client);
    assert.equal(
      (
        await rows(
          `select * from storage.objects where name='${pid}/${upload}'`,
        )
      ).length,
      0,
    );
    await asUser(db, owner);
    await db.exec(`select public.archive_project('${pid}',true,'retain',true)`);
    await assert.rejects(() => reserve(randomUUID()), /not available/);
    await asUser(db, client);
    await assert.rejects(() => reserve(randomUUID(), "asset"), /not available/);
  } finally {
    await db.close();
  }
});
test("discard keeps the upload lease for deletion safety; frozen client deletion waits for signed upload links then checks late bytes", async () => {
  const db = await workspaceDb("202610300013_file_security.sql");
  const owner = randomUUID(),
    cid = randomUUID(),
    pid = randomUUID(),
    upload = randomUUID(),
    hash = "c".repeat(64);
  try {
    await db.exec(
      `insert into auth.users(id)values('${owner}');insert into public.profiles values('${owner}','admin',null);insert into public.clients(id,name,contact,email)values('${cid}','Fictional','Test','test@example.com');insert into public.projects(id,client_id,name,type,due,budget)values('${pid}','${cid}','Files','Brand Identity','2027-01-01',100);`,
    );
    await asUser(db, owner);
    await db.exec(
      `select public.reserve_file_upload('${pid}','${upload}','document','Source.ai',20,'${hash}','application/postscript')`,
    );
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false);set role service_role",
    );
    await db.exec(`select public.discard_file_intake('${upload}')`);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<any>(
          `select discarded_at is not null as discarded from public.upload_intakes where id='${upload}'`,
        )
      ).rows[0].discarded,
      true,
    );
    await asUser(db, owner);
    const plan = (
      await db.query<any>(
        `select public.prepare_client_deletion('${cid}','Fictional') as plan`,
      )
    ).rows[0].plan;
    assert.ok(Date.parse(plan.wait_until) > Date.now());
    await assert.rejects(
      () => db.exec(`select public.finish_client_deletion('${cid}')`),
      /must expire/,
    );
    await assert.rejects(
      () =>
        db.exec(
          `insert into storage.objects(bucket_id,name)values('project-files','${pid}/${upload}')`,
        ),
      /row-level security/,
    );
    await db.exec("reset role");
    await db.exec(
      `update public.upload_intakes set checked_at=now()-interval '3 hours' where id='${upload}';insert into storage.objects(bucket_id,name)values('project-files','${pid}/${upload}')`,
    );
    await asUser(db, owner);
    const retry = (
      await db.query<any>(
        `select public.prepare_client_deletion('${cid}','Fictional') as plan`,
      )
    ).rows[0].plan;
    assert.deepEqual(retry.files, [
      { bucket: "project-files", path: pid + "/" + upload },
    ]);
    await assert.rejects(
      () => db.exec(`select public.finish_client_deletion('${cid}')`),
      /cleanup is incomplete/,
    );
    await db.exec("reset role");
    await db.exec(`delete from storage.objects where name='${pid}/${upload}'`);
    await asUser(db, owner);
    await db.exec(`select public.finish_client_deletion('${cid}')`);
    assert.equal(
      (await db.query(`select * from public.clients where id='${cid}'`)).rows
        .length,
      0,
    );
  } finally {
    await db.close();
  }
});

test("early contract uploads keep explicit original binding and cannot imply verified signatures or payments", async () => {
  const db = await workspaceDb();
  const owner = randomUUID(),
    client = randomUUID(),
    cid = randomUUID(),
    pid = randomUUID(),
    sid = randomUUID(),
    doc = randomUUID(),
    upload = randomUUID(),
    hash = "f".repeat(64);
  const reserve = (
    id: string,
    original: string | null,
    kind = "contract",
    size = 20,
  ) =>
    db.query(
      "select public.reserve_file_upload($1,$2,$3,$4,$5,$6,$7,$8,original_contract=>$9)",
      [
        pid,
        id,
        kind,
        "Return.pdf",
        size,
        hash,
        "application/pdf",
        sid,
        original,
      ],
    );
  try {
    await db.exec(
      `insert into auth.users(id)values('${owner}'),('${client}');insert into public.clients(id,name,contact,email)values('${cid}','Fictional','Test','test@example.com');insert into public.profiles values('${owner}','admin',null),('${client}','client','${cid}');insert into public.projects(id,client_id,name,type,due,budget)values('${pid}','${cid}','Early agreement','Brand Identity','2027-01-01',100);insert into public.stages(id,project_id,name,stream,position)values('${sid}','${pid}','Contract','Onboarding',0);insert into public.documents(id,project_id,stage_id,name,object_path,category,document_role,published)values('${doc}','${pid}','${sid}','Original.pdf','${pid}/${doc}','document','Contract',true);insert into public.prospect_spaces(project_id,enabled,release_step,enquiry_status,booking_url,contract_stage_id)values('${pid}',true,'agreement','new','https://calendly.com/alex-bell-arts/new-meeting','${sid}');`,
    );
    await db.exec(
      await readFile(
        "supabase/migrations/202610300013_file_security.sql",
        "utf8",
      ),
    );
    await asUser(db, client);
    await assert.rejects(
      () => reserve(randomUUID(), null),
      /original contract/,
    );
    await assert.rejects(
      () => reserve(randomUUID(), doc, "asset"),
      /Project access/,
    );
    await assert.rejects(
      () => reserve(randomUUID(), doc, "contract", 4 * 1024 * 1024),
      /up to 3 MB/,
    );
    await reserve(upload, doc);
    await db.exec(
      `insert into storage.objects(bucket_id,name)values('client-assets','${pid}/${upload}')`,
    );
    assert.equal(
      (await db.query<any>(`select public.prospect_area() as area`)).rows[0]
        .area[0].returns.length,
      0,
      "pending returns stay out of early-area DTOs",
    );
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false);set role service_role",
    );
    await db.exec(
      `select public.complete_file_check('${upload}','clean',20,'${hash}','application/pdf')`,
    );
    await asUser(db, client);
    const entry = (await db.query<any>("select public.prospect_area() as area"))
      .rows[0].area[0];
    assert.equal(entry.returns[0].contract_document_id, doc);
    assert.equal(entry.contract_signed, false);
    assert.equal(entry.deposit_paid, false);
    assert.equal(
      (
        await db.query(
          `select * from storage.objects where name='${pid}/${upload}'`,
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.projects")).rows.length,
      0,
      "full journey stays hidden",
    );
    await asUser(db, owner);
    assert.equal(
      (await db.query("select * from public.project_verifications")).rows
        .length,
      0,
    );
  } finally {
    await db.close();
  }
});
