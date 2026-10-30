import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient, createClient } from "@supabase/supabase-js";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
// Small provider adapter for running the ACTUAL diagnostic against PostgreSQL
// RLS/functions. Storage bytes and bearer URLs are fictional; this is not hosted
// Supabase/Storage acceptance. The mutex keeps each simulated JWT transaction isolated.
export async function diagnosticDb(
  db: PGlite,
  options: { removeFails?: boolean; removeNoop?: boolean } = {},
) {
  const bytes = new Map<string, Buffer>(),
    tokens = new Map<string, Buffer>();
  const accounts = new Map<string, { id: string; password: string }>();
  let tail: Promise<unknown> = Promise.resolve();
  const query = async (
    uid: string | null,
    system: boolean,
    sql: string,
    params: unknown[] = [],
  ) => {
    const result = tail.then(async () => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        uid ?? "",
      ]);
      if (!system) await db.exec("set role authenticated");
      return params.length
        ? db.query<Record<string, any>>(sql, params)
        : (((await db.exec(sql)).at(-1) ?? { rows: [] }) as {
            rows: Record<string, any>[];
          });
    });
    tail = result.catch(() => {});
    return result;
  };
  const system = (sql: string, params: unknown[] = []) =>
    query(null, true, sql, params);
  const server = createServer((req, res) => {
    const value = tokens.get(req.url?.slice(1) ?? "");
    res.writeHead(value ? 200 : 404, { "Content-Type": "application/pdf" });
    res.end(value ?? "Not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Fixture server unavailable");
  const origin = "http://127.0.0.1:" + address.port;
  const identifier = (name: string) => {
    if (!/^[a-z_][a-z0-9_]*$/.test(name))
      throw Error("Unsafe fixture identifier");
    return '"' + name + '"';
  };
  const error = (e: unknown) => ({
    code: (e as { code?: string }).code ?? "FIXTURE_ERROR",
    message: e instanceof Error ? e.message : String(e),
  });
  function client(
    initialUid: string | null = null,
    privileged = false,
  ): SupabaseClient {
    let uid = initialUid;
    const execute = (sql: string, params: unknown[] = []) =>
      query(uid, privileged, sql, params);
    return {
      from(table: string) {
        let kind = "select",
          columns = "*",
          payload: Record<string, unknown> | Record<string, unknown>[],
          single = false;
        const where: { key: string; value: unknown; in?: boolean }[] = [];
        const builder: any = {
          select(value = "*") {
            columns = value;
            return this;
          },
          insert(value: Record<string, unknown> | Record<string, unknown>[]) {
            kind = "insert";
            payload = value;
            return this;
          },
          update(value: Record<string, unknown>) {
            kind = "update";
            payload = value;
            return this;
          },
          delete() {
            kind = "delete";
            return this;
          },
          eq(key: string, value: unknown) {
            where.push({ key, value });
            return this;
          },
          in(key: string, value: unknown[]) {
            where.push({ key, value, in: true });
            return this;
          },
          single() {
            single = true;
            return this;
          },
          then(resolve: any, reject: any) {
            return (async () => {
              try {
                const params: unknown[] = [];
                const bind = (v: unknown) => {
                  params.push(v);
                  return "$" + params.length;
                };
                const projection =
                  columns === "*"
                    ? "*"
                    : columns.split(",").map(identifier).join(",");
                let sql = "";
                if (kind === "insert") {
                  const rows = Array.isArray(payload) ? payload : [payload];
                  const keys = Object.keys(rows[0]);
                  sql =
                    "insert into public." +
                    identifier(table) +
                    "(" +
                    keys.map(identifier).join(",") +
                    ")values" +
                    rows
                      .map(
                        (row) =>
                          "(" + keys.map((k) => bind(row[k])).join(",") + ")",
                      )
                      .join(",");
                } else if (kind === "update")
                  sql =
                    "update public." +
                    identifier(table) +
                    " set " +
                    Object.entries(payload)
                      .map(
                        ([key, value]) => identifier(key) + "=" + bind(value),
                      )
                      .join(",");
                else
                  sql =
                    (kind === "delete"
                      ? "delete from "
                      : "select " + projection + " from ") +
                    "public." +
                    identifier(table);
                if (where.length)
                  sql +=
                    " where " +
                    where
                      .map(
                        (w) =>
                          identifier(w.key) +
                          (w.in
                            ? "=any(" + bind(w.value) + ")"
                            : "=" + bind(w.value)),
                      )
                      .join(" and ");
                if (kind !== "select") sql += " returning " + projection;
                const result = await execute(sql, params);
                return single
                  ? result.rows.length === 1
                    ? { data: result.rows[0], error: null }
                    : {
                        data: null,
                        error: {
                          code: "PGRST116",
                          message: "Expected one row",
                        },
                      }
                  : { data: result.rows, error: null };
              } catch (e) {
                return { data: null, error: error(e) };
              }
            })().then(resolve, reject);
          },
        };
        return builder;
      },
      async rpc(name: string, args: Record<string, unknown> = {}) {
        try {
          const entries = Object.entries(args);
          const sql =
            "select public." +
            identifier(name) +
            "(" +
            entries.map(([k], i) => identifier(k) + "=>$" + (i + 1)).join(",") +
            ") as value";
          return {
            data: (
              await execute(
                sql,
                entries.map(([, value]) => value),
              )
            ).rows[0].value,
            error: null,
          };
        } catch (e) {
          return { data: null, error: error(e) };
        }
      },
      auth: {
        async signInWithPassword(input: { email: string; password: string }) {
          const account = accounts.get(input.email);
          if (!account || account.password !== input.password)
            return { error: { message: "Fixture login failed" } };
          uid = account.id;
          return { error: null };
        },
        async signOut() {
          return { error: null };
        },
        admin: {
          async createUser(input: { email: string; password: string }) {
            const id = randomUUID();
            await system(
              "insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())",
              [id, input.email],
            );
            accounts.set(input.email, { id, password: input.password });
            return { data: { user: { id, email: input.email } }, error: null };
          },
          async deleteUser(id: string) {
            try {
              await system("delete from auth.users where id=$1", [id]);
              return { error: null };
            } catch (e) {
              return { error: error(e) };
            }
          },
        },
      },
      storage: {
        from(bucket: string) {
          const permitted = async (path: string) => {
            const rows = await execute(
              "select name from storage.objects where bucket_id=$1 and name=$2",
              [bucket, path],
            );
            return rows.rows.length === 1;
          };
          return {
            async upload(path: string, data: Buffer) {
              try {
                await execute(
                  "insert into storage.objects(bucket_id,name)values($1,$2)",
                  [bucket, path],
                );
                bytes.set(bucket + "/" + path, Buffer.from(data));
                return { data: { path }, error: null };
              } catch (e) {
                return { data: null, error: error(e) };
              }
            },
            async download(path: string) {
              if (!(await permitted(path)) || !bytes.has(bucket + "/" + path))
                return { data: null, error: { status: 404 } };
              return {
                data: new Blob([
                  new Uint8Array(bytes.get(bucket + "/" + path)!),
                ]),
                error: null,
              };
            },
            async createSignedUrl(path: string) {
              if (!(await permitted(path)) || !bytes.has(bucket + "/" + path))
                return { data: null, error: { status: 404 } };
              const token = randomUUID();
              tokens.set(token, bytes.get(bucket + "/" + path)!);
              return { data: { signedUrl: origin + "/" + token }, error: null };
            },
            async remove(paths: string[]) {
              if (privileged && options.removeFails)
                return { error: { status: 503 }, data: null };
              if (privileged && options.removeNoop)
                return { error: null, data: [] };
              const deleted = await execute(
                "delete from storage.objects where bucket_id=$1 and name=any($2) returning name",
                [bucket, paths],
              );
              for (const row of deleted.rows)
                bytes.delete(bucket + "/" + row.name);
              return { error: null, data: deleted.rows };
            },
            async list(prefix: string, opts: { search: string }) {
              const rows = await execute(
                "select name from storage.objects where bucket_id=$1 and name like $2",
                [bucket, prefix + "/%"],
              );
              return {
                error: null,
                data: rows.rows
                  .filter((row) =>
                    row.name.slice(prefix.length + 1).includes(opts.search),
                  )
                  .map((row) => ({ name: row.name.slice(prefix.length + 1) })),
              };
            },
          };
        },
      },
    } as unknown as SupabaseClient;
  }
  return {
    client,
    system,
    bytes,
    origin,
    factory: ((_url: string, _key: string) => client()) as typeof createClient,
    async close() {
      await tail;
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    },
  };
}
