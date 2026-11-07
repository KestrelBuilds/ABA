import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { workspaceDb, asUser } from "./helpers/workspace-db";
for (const scanned of [false, true])
  test(`sequential stage access enforces owner progress on metadata, raw files, forms and uploads (${scanned ? "with optional quarantine" : "without 013"})`, async () => {
    const db = await workspaceDb();
    const owner = randomUUID(),
      client = randomUUID(),
      other = randomUUID(),
      cid = randomUUID(),
      pid = randomUUID(),
      first = randomUUID(),
      second = randomUUID(),
      third = randomUUID(),
      hidden = randomUUID(),
      doc = randomUUID(),
      asset = randomUUID();
    const rows = async (sql: string) =>
      (await db.query<Record<string, any>>(sql)).rows;
    try {
      await db.exec(
        `insert into auth.users(id)values('${owner}'),('${client}'),('${other}');insert into public.profiles values('${owner}','admin',null);insert into public.clients(id,name,contact,email)values('${cid}','Fictional','Test','test@example.com');insert into public.profiles values('${client}','client','${cid}');insert into public.projects(id,client_id,name,type,due,budget,contract_signed,deposit_paid,final_paid,final_approved)values('${pid}','${cid}','Journey','Brand Identity','2027-01-01',1000,true,true,true,true);insert into public.stages(id,project_id,name,stream,position,status,visible,purpose)values('${first}','${pid}','Enquiry Stage','Onboarding',0,'In Progress',true,'progress'),('${second}','${pid}','Onboarding','Onboarding',1,'Not Started',true,'progress'),('${hidden}','${pid}','Private preparation','Brand Identity',2,'Not Started',false,'progress'),('${third}','${pid}','Goodbye Packet','Delivery',3,'Not Started',true,'progress');insert into public.documents(id,project_id,stage_id,name,object_path,category,published,document_role)values('${doc}','${pid}','${second}','Brief.pdf','${pid}/${doc}','presentation',true,'Presentation');insert into public.client_assets(id,project_id,stage_id,uploader_id,name,object_path)values('${asset}','${pid}','${second}','${client}','Client.pdf','${pid}/${asset}');insert into public.stage_resources(stage_id,instructions)values('${second}','Private until unlocked');insert into storage.objects(bucket_id,name)values('project-files','${pid}/${doc}'),('client-assets','${pid}/${asset}');`,
      );
      if (scanned)
        await db.exec(
          await readFile(
            "supabase/migrations/202610300013_file_security.sql",
            "utf8",
          ),
        );
      await db.exec(
        await readFile(
          "supabase/migrations/202611070014_stage_journey.sql",
          "utf8",
        ),
      );
      await db.exec(
        `insert into public.project_handover(project_id,body)values('${pid}','Final handover instructions')`,
      );
      await asUser(db, client);
      assert.equal(
        (await rows("select * from public.project_handover")).length,
        0,
      );
      assert.equal(
        (await rows(`select public.stage_client_unlocked('${first}') as ok`))[0]
          .ok,
        true,
      );
      assert.equal(
        (
          await rows(`select public.stage_client_unlocked('${second}') as ok`)
        )[0].ok,
        false,
      );
      assert.equal(
        (await rows(`select * from public.documents where id='${doc}'`)).length,
        0,
      );
      assert.equal(
        (await rows(`select * from public.client_assets`)).length,
        0,
      );
      assert.equal(
        (await rows(`select * from public.stage_resources`)).length,
        0,
      );
      assert.equal((await rows(`select * from storage.objects`)).length, 0);
      assert.equal(
        (await rows(`select public.can_read_document('${doc}') as ok`))[0].ok,
        false,
      );
      const access = (
        await rows("select public.client_stage_access() as data")
      )[0].data;
      assert.equal(access.length, 3);
      assert.ok(!access.some((s: any) => s.id === hidden));
      await assert.rejects(() =>
        db.exec(
          `insert into public.feedback(document_id,author_id,body,decision)values('${doc}','${client}','No','approved')`,
        ),
      );
      await assert.rejects(() =>
        db.exec(
          `insert into public.questionnaires(project_id,kind,answers,submitted_by)values('${pid}','brand','{"business":"No"}','${client}')`,
        ),
      );
      assert.equal(
        (
          await rows(
            `update public.stages set status='Completed' where id='${first}' returning id`,
          )
        ).length,
        0,
      );
      await asUser(db, owner);
      await db.exec(
        `update public.stages set status='Completed' where id='${first}'`,
      );
      await asUser(db, client);
      assert.equal(
        (await rows(`select * from public.documents where id='${doc}'`)).length,
        1,
      );
      assert.equal((await rows(`select * from storage.objects`)).length, 2);
      assert.equal(
        (await rows(`select * from public.stage_resources`)).length,
        1,
      );
      await db.exec(
        `insert into public.feedback(document_id,author_id,body,decision)values('${doc}','${client}','Review','comment')`,
      );
      assert.equal(
        (await rows(`select public.stage_client_unlocked('${third}') as ok`))[0]
          .ok,
        false,
      );
      await asUser(db, owner);
      await db.exec(
        `update public.stages set status='Completed' where id='${second}'`,
      );
      await asUser(db, client);
      assert.equal(
        (await rows(`select public.stage_client_unlocked('${third}') as ok`))[0]
          .ok,
        false,
        "hidden unfinished stages still block",
      );
      await asUser(db, owner);
      await db.exec(
        `update public.stages set status='Completed' where id='${hidden}';update public.stages set name='Delivery pack' where id='${third}'`,
      );
      await asUser(db, client);
      assert.equal(
        (await rows(`select public.stage_client_unlocked('${third}') as ok`))[0]
          .ok,
        true,
      );
      assert.equal(
        (await rows("select * from public.project_handover")).length,
        1,
      );
      const newAsset = randomUUID();
      await assert.rejects(
        () =>
          db.exec(
            `insert into public.client_assets(id,project_id,stage_id,uploader_id,name,object_path)values('${newAsset}','${pid}','${third}','${client}','No.pdf','${pid}/${newAsset}')`,
          ),
        "renaming goodbye does not restore client uploads",
      );
      await asUser(db, owner);
      await db.exec(
        `update public.stages set status='Completed',purpose='final_payment' where id='${second}';update public.projects set final_paid=false where id='${pid}'`,
      );
      await asUser(db, client);
      assert.equal(
        (await rows(`select public.stage_client_unlocked('${third}') as ok`))[0]
          .ok,
        false,
        "ordinary Completed never overrides missing payment verification",
      );
      await asUser(db, other);
      assert.deepEqual(
        (await rows("select public.client_stage_access() as data"))[0].data,
        [],
      );
      assert.equal(
        (await rows(`select public.stage_client_unlocked('${first}') as ok`))[0]
          .ok,
        false,
      );
    } finally {
      await db.close();
    }
  });

test("early proposal and contract helpers follow the same stage sequence without an onboarding deadlock", async () => {
  const db = await workspaceDb();
  const owner = randomUUID(),
    client = randomUUID(),
    cid = randomUUID(),
    pid = randomUUID(),
    enquiry = randomUUID(),
    proposal = randomUUID(),
    contract = randomUUID(),
    invoice = randomUUID(),
    onboarding = randomUUID(),
    pd = randomUUID(),
    cd = randomUUID(),
    id = randomUUID();
  const rows = async (sql: string) =>
    (await db.query<Record<string, any>>(sql)).rows;
  try {
    await db.exec(
      `insert into auth.users(id)values('${owner}'),('${client}');insert into public.clients(id,name,contact,email)values('${cid}','Fictional prospect','Test','test@example.com');insert into public.profiles values('${owner}','admin',null),('${client}','client','${cid}');insert into public.projects(id,client_id,name,type,due,budget)values('${pid}','${cid}','Early journey','Brand Identity','2027-01-01',1000);insert into public.stages(id,project_id,name,stream,position,purpose)values('${enquiry}','${pid}','Enquiry Stage','Onboarding',0,'progress'),('${proposal}','${pid}','Project Proposal','Onboarding',1,'progress'),('${contract}','${pid}','Contract','Onboarding',2,'contract'),('${invoice}','${pid}','Invoice','Onboarding',3,'deposit'),('${onboarding}','${pid}','Onboarding','Onboarding',4,'progress');insert into public.documents(id,project_id,stage_id,name,object_path,category,published,document_role)values('${pd}','${pid}','${proposal}','Proposal.pdf','${pid}/${pd}','document',true,'Proposal'),('${cd}','${pid}','${contract}','Contract.pdf','${pid}/${cd}','document',true,'Contract'),('${id}','${pid}','${invoice}','Invoice.pdf','${pid}/${id}','document',true,'Invoice');insert into public.prospect_spaces(project_id,enabled,release_step,enquiry_status,proposal_stage_id,contract_stage_id,invoice_stage_id)values('${pid}',true,'agreement','considering','${proposal}','${contract}','${invoice}');`,
    );
    await db.exec(
      await readFile(
        "supabase/migrations/202611070014_stage_journey.sql",
        "utf8",
      ),
    );
    await asUser(db, client);
    assert.equal(
      (await rows(`select public.can_read_prospect_document('${pd}') as ok`))[0]
        .ok,
      false,
    );
    assert.deepEqual(
      (await rows("select public.prospect_area() as data"))[0].data[0]
        .documents,
      [],
    );
    await asUser(db, owner);
    await db.exec(
      `update public.stages set status='Completed' where id='${enquiry}'`,
    );
    await asUser(db, client);
    assert.equal(
      (await rows(`select public.can_read_prospect_document('${pd}') as ok`))[0]
        .ok,
      true,
    );
    assert.equal(
      (await rows(`select public.can_read_contract_document('${cd}') as ok`))[0]
        .ok,
      false,
    );
    await asUser(db, owner);
    await db.exec(
      `update public.stages set status='Completed' where id='${proposal}'`,
    );
    await asUser(db, client);
    assert.equal(
      (await rows(`select public.can_read_contract_document('${cd}') as ok`))[0]
        .ok,
      true,
    );
    assert.equal(
      (await rows(`select public.can_access_project('${pid}') as ok`))[0].ok,
      false,
    );
    assert.equal(
      (await rows(`select public.can_read_document('${id}') as ok`))[0].ok,
      false,
    );
    await asUser(db, owner);
    await db.exec(
      `update public.projects set contract_signed=true where id='${pid}'`,
    );
    await asUser(db, client);
    assert.equal(
      (await rows(`select public.can_read_document('${id}') as ok`))[0].ok,
      true,
    );
    await asUser(db, owner);
    await db.exec(
      `update public.projects set deposit_paid=true where id='${pid}'`,
    );
    await asUser(db, client);
    assert.equal(
      (await rows(`select public.can_access_project('${pid}') as ok`))[0].ok,
      true,
    );
    assert.equal(
      (
        await rows(`select public.stage_client_unlocked('${onboarding}') as ok`)
      )[0].ok,
      true,
    );
  } finally {
    await db.close();
  }
});
