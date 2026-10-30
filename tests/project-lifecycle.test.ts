import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { workspaceDb, asUser } from "./helpers/workspace-db";
import { newProjectStages } from "../lib/workflow-templates";
test("archiving preserves data, deliberately retains or suspends full/early/raw-storage access, and retains archives read-only", async () => {
  const db = await workspaceDb();
  const owner = randomUUID(),
    client = randomUUID(),
    other = randomUUID(),
    cid = randomUUID(),
    pid = randomUUID(),
    early = randomUUID(),
    sid = randomUUID(),
    eid = randomUUID(),
    doc = randomUUID(),
    edoc = randomUUID(),
    asset = randomUUID();
  const rows = async (sql: string) =>
    (await db.query<Record<string, any>>(sql)).rows;
  try {
    await db.exec(
      `insert into auth.users(id)values('${owner}'),('${client}'),('${other}');insert into public.clients(id,name,contact,email)values('${cid}','Fictional','Test','test@example.com');insert into public.profiles values('${owner}','admin',null),('${client}','client','${cid}');insert into public.projects(id,client_id,name,type,due,budget,contract_signed,deposit_paid)values('${pid}','${cid}','Full','Brand Identity','2027-01-01',100,true,true),('${early}','${cid}','Early','Website Design','2027-01-01',100,false,false);insert into public.stages(id,project_id,name,stream,position)values('${sid}','${pid}','Work','Brand Identity',0),('${eid}','${early}','Agreement','Onboarding',0);insert into public.documents(id,project_id,stage_id,name,object_path,category,published,document_role)values('${doc}','${pid}','${sid}','Work.pdf','${pid}/${doc}','document',true,'General'),('${edoc}','${early}','${eid}','Contract.pdf','${early}/${edoc}','document',true,'Contract');insert into public.client_assets(id,project_id,stage_id,uploader_id,name,object_path)values('${asset}','${pid}','${sid}','${client}','Client.pdf','${pid}/${asset}');insert into public.prospect_spaces(project_id,enabled,release_step,enquiry_status,booking_url,contract_stage_id)values('${early}',true,'agreement','new','https://calendly.com/alex-bell-arts/new-meeting','${eid}');insert into storage.objects(bucket_id,name)values('project-files','${pid}/${doc}'),('project-files','${early}/${edoc}'),('client-assets','${pid}/${asset}');`,
    );
    const before = await rows(
      `select contract_signed,deposit_paid,final_paid,final_approved from public.projects where id='${pid}'`,
    );
    assert.equal(
      (
        await rows(
          "select count(*)::int as n from public.project_verifications",
        )
      )[0].n,
      0,
    );
    await asUser(db, owner);
    await db.exec(`select public.archive_project('${pid}',true,'retain',true)`);
    assert.deepEqual(
      await rows(
        `select contract_signed,deposit_paid,final_paid,final_approved from public.projects where id='${pid}'`,
      ),
      before,
    );
    await asUser(db, client);
    assert.equal(
      (await rows(`select public.can_access_project('${pid}') as ok`))[0].ok,
      true,
    );
    assert.equal(
      (await rows(`select * from public.documents where id='${doc}'`)).length,
      1,
    );
    assert.equal(
      (await rows(`select * from storage.objects where name='${pid}/${doc}'`))
        .length,
      1,
    );
    assert.equal(
      (
        await rows(
          `delete from storage.objects where bucket_id='client-assets' and name='${pid}/${asset}' returning *`,
        )
      ).length,
      0,
      "retained archives also deny direct Storage deletion",
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.client_assets(project_id,uploader_id,name,object_path)values('${pid}','${client}','No.pdf','${pid}/'||gen_random_uuid())`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.feedback(document_id,author_id,body,decision)values('${doc}','${client}','No','comment')`,
      ),
    );
    await asUser(db, owner);
    await db.exec(
      `select public.archive_project('${pid}',true,'suspend',true);select public.archive_project('${early}',true,'suspend',true);`,
    );
    await asUser(db, client);
    assert.equal((await rows(`select * from public.projects`)).length, 0);
    assert.equal((await rows(`select * from public.documents`)).length, 0);
    assert.equal((await rows(`select * from public.client_assets`)).length, 0);
    assert.equal((await rows(`select * from storage.objects`)).length, 0);
    assert.equal(
      (await rows(`select public.can_read_document('${edoc}') as ok`))[0].ok,
      false,
    );
    assert.deepEqual(
      (await rows(`select public.prospect_area() as result`))[0].result,
      [],
    );
    await assert.rejects(() =>
      db.exec(`select public.archive_project('${pid}',false,'retain',true)`),
    );
    await asUser(db, other);
    assert.equal((await rows(`select * from public.projects`)).length, 0);
    await asUser(db, owner);
    assert.equal(
      (await rows(`select public.client_invitation_ready('${cid}') as ok`))[0]
        .ok,
      false,
    );
    assert.equal((await rows(`select * from public.documents`)).length, 2);
    await db.exec(
      `select public.archive_project('${early}',true,'retain',true)`,
    );
    assert.equal(
      (await rows(`select public.client_invitation_ready('${cid}') as ok`))[0]
        .ok,
      true,
    );
    await asUser(db, client);
    assert.equal(
      (await rows(`select public.can_read_document('${edoc}') as ok`))[0].ok,
      true,
    );
    assert.equal(
      (await rows(`select public.prospect_area() as result`))[0].result.length,
      1,
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.client_assets(project_id,stage_id,contract_document_id,uploader_id,name,object_path)values('${early}','${eid}','${edoc}','${client}','No.pdf','${early}/'||gen_random_uuid())`,
      ),
    );
    await asUser(db, owner);
    await db.exec(
      `select public.archive_project('${pid}',false,'retain',true)`,
    );
    await asUser(db, client);
    assert.equal(
      (await rows(`select public.can_access_project('${pid}') as ok`))[0].ok,
      true,
    );
  } finally {
    await db.close();
  }
});
test("dated verification history is append-only and combined approvals require both streams without rewriting legacy flags", async () => {
  const db = await workspaceDb();
  const owner = randomUUID(),
    client = randomUUID(),
    cid = randomUUID(),
    pid = randomUUID(),
    other = randomUUID(),
    doc = randomUUID();
  const rows = async (sql: string) =>
    (await db.query<Record<string, any>>(sql)).rows;
  try {
    await db.exec(
      `insert into auth.users(id)values('${owner}'),('${client}');insert into public.clients(id,name,contact,email)values('${cid}','Fictional','Test','test@example.com');insert into public.profiles values('${owner}','admin',null),('${client}','client','${cid}');insert into public.projects(id,client_id,name,type,due,budget,contract_signed,deposit_paid,final_approved)values('${pid}','${cid}','Legacy combined','Both','2027-01-01',100,true,true,true),('${other}','${cid}','Other','Brand Identity','2027-01-01',100,false,false,false);insert into public.documents(id,project_id,name,object_path,category)values('${doc}','${other}','Other.pdf','${other}/${doc}','document');`,
    );
    await asUser(db, owner);
    assert.equal(
      (
        await rows(
          "select count(*)::int as n from public.project_verifications",
        )
      )[0].n,
      0,
    );
    assert.equal(
      (
        await rows(
          `select separate_approvals from public.projects where id='${pid}'`,
        )
      )[0].separate_approvals,
      false,
    );
    await assert.rejects(() =>
      db.exec(`select public.enable_stream_approvals('${pid}',false)`),
    );
    await db.exec(`select public.enable_stream_approvals('${pid}',true)`);
    assert.equal(
      (
        await rows(
          `select final_approved from public.projects where id='${pid}'`,
        )
      )[0].final_approved,
      false,
    );
    await assert.rejects(() =>
      db.exec(
        `update public.projects set final_approved=true where id='${pid}'`,
      ),
    );
    await db.exec(
      `select public.verify_stream_approval('${pid}','Brand Identity',true,'Email approval',null)`,
    );
    assert.equal(
      (
        await rows(
          `select final_approved from public.projects where id='${pid}'`,
        )
      )[0].final_approved,
      false,
    );
    await db.exec(
      `select public.verify_stream_approval('${pid}','Website Design',true,'Website review',null)`,
    );
    assert.equal(
      (
        await rows(
          `select final_approved from public.projects where id='${pid}'`,
        )
      )[0].final_approved,
      true,
    );
    await db.exec(
      `select public.verify_stream_approval('${pid}','Brand Identity',false,'New revision needed',null)`,
    );
    assert.equal(
      (
        await rows(
          `select final_approved from public.projects where id='${pid}'`,
        )
      )[0].final_approved,
      false,
    );
    await assert.rejects(() =>
      db.exec(
        `select public.verify_project_record('${pid}','final_approved',true,'',null,null)`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `select public.verify_project_record('${pid}','final_paid',true,'',current_date+1,null)`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `select public.verify_project_record('${pid}','final_paid',true,'',null,'${doc}')`,
      ),
    );
    await db.exec(
      `select public.verify_project_record('${pid}','final_paid',true,'Bank reference ABC',current_date,null)`,
    );
    const events = await rows(
      `select * from public.project_verifications where field='final_paid'`,
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].actor_id, owner);
    assert.equal(events[0].reference, "Bank reference ABC");
    assert.ok(events[0].recorded_at);
    assert.ok(events[0].occurred_on);
    await assert.rejects(() =>
      db.exec(`update public.project_verifications set reference='Tampered'`),
    );
    await assert.rejects(() =>
      db.exec(`delete from public.project_verifications`),
    );
    const created = (
      await db.query<{ id: string }>(
        "select public.create_project($1,$2,$3,$4,$5,$6::jsonb) as id",
        [
          "New combined",
          cid,
          "Both",
          "2027-01-01",
          100,
          JSON.stringify(newProjectStages("Both")),
        ],
      )
    ).rows[0].id;
    assert.equal(
      (
        await rows(
          `select separate_approvals from public.projects where id='${created}'`,
        )
      )[0].separate_approvals,
      true,
    );
    await asUser(db, client);
    assert.equal(
      (await rows("select * from public.project_verifications")).length,
      0,
    );
    assert.equal(
      (await rows("select * from public.project_stream_approvals")).length,
      0,
    );
    await assert.rejects(() =>
      db.exec(
        `select public.verify_project_record('${pid}','contract_signed',false,'',null,null)`,
      ),
    );
  } finally {
    await db.close();
  }
});
