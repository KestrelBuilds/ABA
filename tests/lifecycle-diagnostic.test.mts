import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { workspaceDb } from "./helpers/workspace-db";
import { diagnosticDb } from "./helpers/diagnostic-db";
import { checkClientPortals } from "../lib/supabase/portal-check";
async function setup(
  options: {
    last?: string;
    removeFails?: boolean;
    removeNoop?: boolean;
    brokenReadonly?: boolean;
  } = {},
) {
  const db = await workspaceDb(options.last);
  const fixture = await diagnosticDb(db, options);
  const owner = randomUUID(),
    existingUser = randomUUID(),
    cid = randomUUID(),
    pid = randomUUID(),
    doc = randomUUID();
  try {
    await fixture.system(
      `alter table auth.users add column email_confirmed_at timestamptz;insert into auth.users(id)values('${owner}'),('${existingUser}');insert into public.clients(id,name,contact,email)values('${cid}','Unrelated fictional business','Existing','existing@example.com');insert into public.profiles values('${owner}','admin',null),('${existingUser}','client','${cid}');insert into public.projects(id,client_id,name,type,due,budget,contract_signed,deposit_paid)values('${pid}','${cid}','Unrelated fictional project','Brand Identity','2027-01-01',100,true,true);insert into public.documents(id,project_id,name,object_path,category,published)values('${doc}','${pid}','Existing.pdf','${pid}/${doc}','document',true);insert into storage.objects(bucket_id,name)values('project-files','${pid}/${doc}');`,
    );
  } catch (error) {
    await fixture.close();
    throw error;
  }
  const existingPath = "project-files/" + pid + "/" + doc;
  fixture.bytes.set(
    existingPath,
    Buffer.from("Unrelated fictional original bytes"),
  );
  if (options.brokenReadonly)
    await fixture.system("drop policy lifecycle_insert on public.feedback");
  const priorUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    priorKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = fixture.origin;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fictional-public-key";
  return {
    ...fixture,
    owner,
    cid,
    pid,
    doc,
    existingUser,
    existingPath,
    async run() {
      return checkClientPortals(
        fixture.client(owner),
        fixture.client(null, true),
        fixture.factory,
      );
    },
    async close() {
      if (priorUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = priorUrl;
      if (priorKey === undefined)
        delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = priorKey;
      await fixture.close();
    },
  };
}
async function originalUnchanged(f: Awaited<ReturnType<typeof setup>>) {
  assert.equal(
    (await f.system("select name from public.clients where id=$1", [f.cid]))
      .rows[0].name,
    "Unrelated fictional business",
  );
  assert.equal(
    (await f.system("select id from auth.users where id=$1", [f.existingUser]))
      .rows.length,
    1,
  );
  assert.deepEqual(
    f.bytes.get(f.existingPath),
    Buffer.from("Unrelated fictional original bytes"),
  );
}
test("complete owner diagnostic uses actual PostgreSQL policies for archive read/write, private evidence, combined raw/signed release and scoped verified cleanup", async () => {
  const f = await setup();
  try {
    const result = await f.run();
    assert.equal(result.ok, true, result.message);
    assert.ok(
      result.checks?.every((check) => check.status === "passed"),
      JSON.stringify(result.checks),
    );
    assert.equal(
      (await f.system("select id from public.projects")).rows.length,
      1,
    );
    assert.equal(
      (await f.system("select id from public.clients")).rows.length,
      1,
    );
    assert.equal((await f.system("select id from auth.users")).rows.length, 2);
    assert.equal(f.bytes.size, 1);
    assert.ok(
      (await f.system("select id from public.audit_events")).rows.length > 0,
    );
    assert.ok(
      (
        await f.system(
          "select id from public.project_verifications where project_id is null",
        )
      ).rows.length > 0,
    );
    await originalUnchanged(f);
  } finally {
    await f.close();
  }
});
test("older installations retain baseline diagnostic and explicitly report the lifecycle checks unavailable", async () => {
  const f = await setup({ last: "202610300011_stage_purposes.sql" });
  try {
    const result = await f.run();
    assert.equal(result.ok, true, result.message);
    assert.equal(result.checks?.[3].status, "unavailable");
    assert.match(result.message, /Lifecycle checks were not run/);
    await originalUnchanged(f);
  } finally {
    await f.close();
  }
});
test("a real archived-write policy regression fails the diagnostic and still cleans up its allocated fixtures", async () => {
  const f = await setup({ brokenReadonly: true });
  try {
    const result = await f.run();
    assert.equal(result.ok, false);
    assert.match(result.message, /Retained archive write protection/);
    assert.equal(result.checks?.[3].status, "failed");
    assert.equal(result.checks?.[5].status, "passed");
    assert.equal(f.bytes.size, 1);
    await originalUnchanged(f);
  } finally {
    await f.close();
  }
});
for (const failure of ["removeFails", "removeNoop"] as const)
  test(
    "temporary records remain inaccessible and recoverable when cleanup " +
      failure,
    async () => {
      const f = await setup({ [failure]: true });
      try {
        const result = await f.run();
        assert.equal(result.ok, false);
        assert.equal(result.checks?.[5].status, "failed");
        assert.match(result.message, /project records retained/);
        assert.doesNotMatch(
          result.message,
          /Temporary accounts, files and records were removed/,
        );
        assert.ok(
          (await f.system("select id from public.projects")).rows.length > 1,
        );
        assert.equal(
          (await f.system("select id from public.profiles where role='client'"))
            .rows.length,
          1,
          "only unrelated client membership remains",
        );
        assert.ok(f.bytes.size > 1);
        await originalUnchanged(f);
      } finally {
        await f.close();
      }
    },
  );
