import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./helpers/database";
import { newProjectStages } from "../lib/workflow-templates";
test("potential-client stages isolate discovery, proposal and agreement before verified full access", async () => {
  const db = await testDatabase();
  const [
    owner,
    client,
    other,
    c1,
    c2,
    p1,
    p2,
    proposalStage,
    contractStage,
    invoiceStage,
    creativeStage,
    proposal,
    contract,
    invoice,
    final,
    creative,
    draft,
    asset,
  ] = Array.from({ length: 18 }, () => randomUUID());
  const rows = async (sql: string) =>
    (await db.query<Record<string, any>>(sql)).rows;
  const as = async (id: string) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  };
  const set = (step: string, status = "new") =>
    db.query("select public.set_prospect_space($1,true,$2,$3,$4,$5,$6,$7)", [
      p1,
      step,
      status,
      "https://calendly.com/alex-bell-arts/new-meeting",
      proposalStage,
      contractStage,
      invoiceStage,
    ]);
  try {
    await db.exec(
      `insert into auth.users values('${owner}'),('${client}'),('${other}');insert into public.clients(id,name,contact,email)values('${c1}','One','Jamie','one@example.com'),('${c2}','Two','Robin','two@example.com');insert into public.profiles values('${owner}','admin',null),('${other}','client','${c2}');insert into public.projects(id,client_id,name,type,due,budget)values('${p1}','${c1}','Potential project','Brand Identity','2027-01-01',1000),('${p2}','${c2}','Other project','Website Design','2027-01-01',1000);insert into public.stages(id,project_id,name,stream,position)values('${proposalStage}','${p1}','Proposal','Onboarding',0),('${contractStage}','${p1}','Contract','Onboarding',1),('${invoiceStage}','${p1}','Deposit','Onboarding',2),('${creativeStage}','${p1}','SECRET creative stage','Brand Identity',3);insert into public.contract_exchanges values('${p1}','${contractStage}',true);insert into public.invitations(client_id,user_id)values('${c1}','${client}');insert into public.project_notes values('${p1}','SECRET NOTES');`,
    );
    for (const [id, stage, role, category, published] of [
      [proposal, proposalStage, "Proposal", "document", true],
      [contract, contractStage, "Contract", "document", true],
      [invoice, invoiceStage, "Invoice", "document", true],
      [final, invoiceStage, "Invoice", "final", true],
      [creative, creativeStage, "Presentation", "presentation", true],
      [draft, proposalStage, "Proposal", "document", false],
    ])
      await db.query(
        "insert into public.documents(id,project_id,stage_id,name,object_path,document_role,category,published)values($1,$2,$3,'Test.pdf',$4,$5,$6,$7)",
        [id, p1, stage, p1 + "/" + id, role, category, published],
      );
    await db.exec(
      "insert into storage.objects(bucket_id,name)select 'project-files',object_path from public.documents",
    );
    await as(owner);
    await set("discovery");
    assert.equal(
      (await rows(`select public.client_invitation_ready('${c1}') as ok`))[0]
        .ok,
      true,
    );
    await as(client);
    await db.exec("select public.accept_invitation()");
    for (const table of [
      "projects",
      "stages",
      "project_notes",
      "documents",
      "feedback",
      "questionnaires",
      "invoices",
      "proposals",
      "prospect_spaces",
    ])
      assert.equal(
        (await rows("select * from public." + table)).length,
        0,
        table,
      );
    assert.equal((await rows("select * from storage.objects")).length, 0);
    assert.equal(
      (await rows("select public.contract_area() as area"))[0].area.length,
      0,
    );
    const discovery = (await rows("select public.prospect_area() as area"))[0]
      .area;
    assert.equal(discovery.length, 1);
    assert.equal(discovery[0].documents.length, 0);
    assert.equal(JSON.stringify(discovery).includes("SECRET"), false);
    await as(owner);
    await set("proposal", "proposal");
    await as(client);
    assert.deepEqual(
      (await rows("select id from public.documents")).map((d) => d.id),
      [proposal],
    );
    assert.equal((await rows("select * from storage.objects")).length, 1);
    await assert.rejects(() =>
      db.exec(
        `insert into public.feedback(document_id,author_id,body,decision)values('${proposal}','${client}','Should not be creative approval','approved')`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.proposal_responses(project_id,document_id,actor_id,decision)values('${p2}','${proposal}','${client}','interested')`,
      ),
    );
    await db.exec(
      `insert into public.proposal_responses(project_id,document_id,actor_id,decision,message)values('${p1}','${proposal}','${client}','interested','I would like to proceed')`,
    );
    await assert.rejects(() =>
      db.exec(
        `insert into public.proposal_responses(project_id,document_id,actor_id,decision)values('${p1}','${proposal}','${client}','declined')`,
      ),
    );
    assert.equal((await rows("select * from public.projects")).length, 0);
    assert.equal(
      (
        await rows(
          `select public.can_read_contract_document('${contract}') as ok`,
        )
      )[0].ok,
      false,
    );
    await as(owner);
    assert.deepEqual(
      (
        await rows(
          `select contract_signed,deposit_paid from public.projects where id='${p1}'`,
        )
      )[0],
      { contract_signed: false, deposit_paid: false },
    );
    await set("agreement", "considering");
    await as(client);
    assert.deepEqual(
      new Set((await rows("select id from public.documents")).map((d) => d.id)),
      new Set([proposal, contract, invoice]),
    );
    assert.equal((await rows("select * from public.stages")).length, 0);
    await db.exec(
      `insert into public.client_assets(id,project_id,stage_id,contract_document_id,uploader_id,name,object_path)values('${asset}','${p1}','${contractStage}','${contract}','${client}','Signed.pdf','${p1}/${asset}');insert into storage.objects(bucket_id,name)values('client-assets','${p1}/${asset}')`,
    );
    await as(other);
    assert.equal(
      (await rows(`select public.prospect_area('${p1}') as area`))[0].area
        .length,
      0,
    );
    assert.equal(
      (await rows("select * from public.proposal_responses")).length,
      0,
    );
    await as(owner);
    await set("agreement", "closed");
    assert.equal(
      (await rows(`select public.client_invitation_ready('${c1}') as ok`))[0]
        .ok,
      false,
    );
    await as(client);
    assert.equal((await rows("select * from public.documents")).length, 0);
    assert.equal((await rows("select * from storage.objects")).length, 0);
    assert.equal(
      (await rows("select public.prospect_area() as area"))[0].area.length,
      0,
    );
    assert.equal(
      (await rows("select public.contract_area() as area"))[0].area.length,
      0,
    );
    await as(owner);
    await set("agreement");
    await db.exec(
      `update public.projects set contract_signed=true where id='${p1}'`,
    );
    await as(client);
    assert.equal((await rows("select * from public.projects")).length, 0);
    await as(owner);
    await db.exec(
      `update public.projects set deposit_paid=true where id='${p1}'`,
    );
    await assert.rejects(() => set("agreement", "closed"));
    await as(client);
    assert.equal((await rows("select * from public.projects")).length, 1);
    assert.equal(
      (await rows(`select * from public.documents where id='${final}'`)).length,
      0,
    );
    await as(owner);
    await db.exec(
      `select public.prepare_client_deletion('${c1}','One');delete from storage.objects where split_part(name,'/',1)='${p1}';select public.finish_client_deletion('${c1}')`,
    );
    assert.equal(
      (await rows("select * from public.prospect_spaces")).length,
      0,
    );
    assert.equal(
      (await rows("select * from public.proposal_responses")).length,
      0,
    );
    assert.equal(
      (await rows(`select * from public.clients where id='${c2}'`)).length,
      1,
    );
  } finally {
    await db.close();
  }
});
test("enquiries are private and conversion is atomic, idempotent and never grants project access", async () => {
  const db = await testDatabase();
  const owner = randomUUID(),
    client = randomUUID();
  const rows = async (sql: string) =>
    (await db.query<Record<string, any>>(sql)).rows;
  try {
    await db.exec(
      `insert into auth.users values('${owner}'),('${client}');insert into public.profiles values('${owner}','admin',null)`,
    );
    await db.exec("set role service_role");
    const payload = {
      event_id: "event",
      form_id: "mOLMrk",
      response_id: "response",
      business_name: "Test company",
      contact_name: "Jamie",
      email: "test@example.com",
      fields: [],
    };
    await db.query("select public.ingest_tally_enquiry($1)", [
      JSON.stringify(payload),
    ]);
    await db.query("select public.ingest_tally_enquiry($1)", [
      JSON.stringify(payload),
    ]);
    const id = (await rows("select * from public.enquiries"))[0].id;
    assert.equal((await rows("select * from public.enquiries")).length, 1);
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      client,
    ]);
    await db.exec("set role authenticated");
    assert.equal((await rows("select * from public.enquiries")).length, 0);
    await assert.rejects(() =>
      db.exec("insert into public.enquiries(source)values('manual')"),
    );
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    await db.exec("set role authenticated");
    const args = [
      id,
      "Test company",
      "Jamie",
      "test@example.com",
      "",
      "Potential site",
      "Website Design",
      "2027-01-01",
      1000,
      JSON.stringify(newProjectStages("Website Design")),
      null,
    ];
    const query =
      "select public.convert_enquiry($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as project";
    const bad = [...args];
    bad[6] = "Invalid";
    await assert.rejects(() => db.query(query, bad));
    assert.equal((await rows("select * from public.clients")).length, 0);
    const project = (await db.query<Record<string, any>>(query, args)).rows[0]
      .project;
    await assert.rejects(() => db.query(query, args));
    assert.equal((await rows("select * from public.clients")).length, 1);
    assert.equal(
      (await rows(`select * from public.stages where project_id='${project}'`))
        .length,
      11,
    );
    assert.equal(
      (await rows("select * from public.prospect_spaces"))[0].enabled,
      false,
    );
    assert.equal(
      (await rows("select * from public.projects"))[0].contract_signed,
      false,
    );
    const c = (await rows("select * from public.clients"))[0].id;
    await db.exec(
      `select public.prepare_client_deletion('${c}','Test company');select public.finish_client_deletion('${c}')`,
    );
    assert.equal((await rows("select * from public.enquiries")).length, 0);
    assert.ok((await rows("select * from public.audit_events")).length > 0);
    await db.exec("reset role;set role service_role");
    await db.query("select public.ingest_tally_enquiry($1)", [
      JSON.stringify(payload),
    ]);
    assert.equal((await rows("select * from public.enquiries")).length, 0);
    assert.equal((await rows("select * from public.tally_receipts")).length, 1);
  } finally {
    await db.close();
  }
});
