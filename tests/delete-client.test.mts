import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteClientRecords } from "../lib/supabase/delete-client";
const client = "10000000-0000-4000-8000-000000000001",
  project = "20000000-0000-4000-8000-000000000001";
function fixture({
  count = 1,
  prepareError = false,
  storageError = false,
  finishError = false,
  wrongPath = false,
} = {}) {
  const calls: { name: string; args: any }[] = [];
  const db = {
    rpc: async (name: string, args: any) => {
      calls.push({ name, args });
      if (name === "prepare_client_deletion")
        return prepareError
          ? {
              error: {
                code: "P0001",
                message:
                  "This client has generated financial records. Keep its history and revoke access instead.",
              },
            }
          : {
              data: {
                client_id: client,
                project_ids: [project],
                files: Array.from({ length: count }, (_, i) => ({
                  bucket: "project-files",
                  path: (wrongPath ? client : project) + "/file-" + i,
                })),
              },
            };
      return { error: finishError ? { message: "remaining storage" } : null };
    },
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          calls.push({ name: "remove", args: { bucket, paths } });
          return { error: storageError ? { message: "Unavailable" } : null };
        },
      }),
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}
test("client deletion uses only prepared file paths, batches storage cleanup and finalizes last", async () => {
  const { db, calls } = fixture({ count: 205 });
  await deleteClientRecords(db, client, "Test client");
  assert.deepEqual(
    calls.map((c) => c.name),
    [
      "prepare_client_deletion",
      "remove",
      "remove",
      "remove",
      "finish_client_deletion",
    ],
  );
  assert.deepEqual(
    calls.filter((c) => c.name === "remove").map((c) => c.args.paths.length),
    [100, 100, 5],
  );
  assert.ok(
    calls
      .filter((c) => c.name === "remove")
      .every(
        (c) =>
          c.args.bucket === "project-files" &&
          c.args.paths.every((p: string) => p.startsWith(project + "/")),
      ),
  );
});
test("financial and path guards stop deletion before touching private storage", async () => {
  for (const options of [{ prepareError: true }, { wrongPath: true }]) {
    const { db, calls } = fixture(options);
    await assert.rejects(() => deleteClientRecords(db, client, "Test client"));
    assert.equal(
      calls.filter(
        (c) => c.name === "remove" || c.name === "finish_client_deletion",
      ).length,
      0,
    );
  }
});
test("storage failure keeps metadata for retry; failed final verification never reports success", async () => {
  const storage = fixture({ storageError: true });
  await assert.rejects(
    () => deleteClientRecords(storage.db, client, "Test client"),
    /Deletion paused during private file cleanup/,
  );
  assert.equal(
    storage.calls.some((c) => c.name === "finish_client_deletion"),
    false,
  );
  const final = fixture({ finishError: true });
  await assert.rejects(
    () => deleteClientRecords(final.db, client, "Test client"),
    /Deletion paused before removing records/,
  );
  const empty = fixture({ count: 0 });
  await deleteClientRecords(empty.db, client, "Empty client");
  assert.deepEqual(
    empty.calls.map((c) => c.name),
    ["prepare_client_deletion", "finish_client_deletion"],
  );
});
