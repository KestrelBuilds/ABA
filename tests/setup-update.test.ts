import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./helpers/database";
test("single setup update installs missing features from 006 or 007, preserves data and safely repeats", async () => {
  const update = await readFile(
    "supabase/updates/20261029_potential_clients_and_tally.sql",
    "utf8",
  );
  for (const through of [6, 7]) {
    const db = await testDatabase(through);
    try {
      const id = randomUUID();
      await db.query<{ fn: string | null }>(
        "insert into public.clients(id,name,contact,email)values($1,'Existing company','Jamie','test@example.com')",
        [id],
      );
      await db.exec(update);
      await db.exec(update);
      assert.equal(
        (await db.query("select * from public.clients")).rows.length,
        1,
      );
      for (const table of [
        "client_deletions",
        "prospect_spaces",
        "enquiries",
        "tally_receipts",
      ]) {
        assert.equal(
          (await db.query("select * from public." + table)).rows.length,
          0,
        );
      }
      assert.ok(
        (
          await db.query<{ fn: string | null }>(
            "select to_regprocedure('public.ingest_tally_enquiry(jsonb)') as fn",
          )
        ).rows[0].fn,
      );
    } finally {
      await db.close();
    }
  }
});
