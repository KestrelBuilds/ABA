import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { asUser, workspaceDb } from "./helpers/workspace-db";

test("owners can reschedule or clear a reviewed presentation date without changing its version, response or release checks; clients cannot", async () => {
  const db = await workspaceDb();
  const owner = randomUUID(),
    client = randomUUID(),
    other = randomUUID(),
    cid = randomUUID(),
    otherCid = randomUUID(),
    pid = randomUUID(),
    document = randomUUID();
  const rows = async (sql: string) =>
    (await db.query<Record<string, unknown>>(sql)).rows;
  try {
    await db.exec(`
      insert into auth.users(id) values('${owner}'),('${client}'),('${other}');
      insert into public.clients(id,name,contact,email) values
        ('${cid}','Fictional studio','Jamie Example','jamie@example.com'),
        ('${otherCid}','Other studio','Robin Example','robin@example.com');
      insert into public.profiles values
        ('${owner}','admin',null),('${client}','client','${cid}'),('${other}','client','${otherCid}');
      insert into public.projects(id,client_id,name,type,due,budget,contract_signed,deposit_paid)
        values('${pid}','${cid}','Fictional identity','Brand Identity','2027-01-01',100,true,true);
      insert into public.documents(id,project_id,name,object_path,category,published,version_label,review_due)
        values('${document}','${pid}','Presentation.pdf','${pid}/${document}','presentation',true,'v2','2027-01-02');
    `);
    await asUser(db, client);
    await db.exec(`insert into public.feedback(document_id,author_id,body,decision)
      values('${document}','${client}','Fictional approval','approved')`);
    for (const user of [client, other]) {
      await asUser(db, user);
      assert.deepEqual(
        await rows(`update public.documents set review_due='2027-01-03'
          where id='${document}' returning id`),
        [],
        "clients cannot set a review date, including on their own presentation",
      );
    }
    await asUser(db, owner);
    const before = (await rows(`select * from public.documents`))[0];
    const feedback = await rows(`select * from public.feedback`);
    const project = await rows(`select * from public.projects`);
    const updates = async () =>
      rows(`select actor_id from public.audit_events
        where entity='documents' and entity_id='${document}' and action='update'`);
    assert.equal((await updates()).length, 0);
    await db.exec(`update public.documents set review_due='2027-01-10'
      where id='${document}' and category='presentation'`);
    assert.deepEqual((await rows(`select * from public.documents`))[0], {
      ...before,
      review_due: new Date("2027-01-10T00:00:00Z"),
    });
    await db.exec(`update public.documents set review_due=null
      where id='${document}' and category='presentation'`);
    assert.deepEqual((await rows(`select * from public.documents`))[0], {
      ...before,
      review_due: null,
    });
    assert.deepEqual(await rows(`select * from public.feedback`), feedback);
    assert.deepEqual(await rows(`select * from public.projects`), project);
    assert.deepEqual(await updates(), [
      { actor_id: owner },
      { actor_id: owner },
    ]);
    await assert.rejects(
      () =>
        db.exec(`update public.documents set version_label='v3'
          where id='${document}'`),
      /reviewed files are immutable/,
    );
    await asUser(db, client);
    assert.deepEqual(
      await rows(`select review_due,version_label from public.documents`),
      [{ review_due: null, version_label: "v2" }],
      "the client reads the saved date under the existing access rules",
    );
  } finally {
    await db.close();
  }
});
