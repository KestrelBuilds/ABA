import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
export async function workspaceDb(last = "202610300012_project_lifecycle.sql") {
  const db = new PGlite();
  await db.exec(
    `create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create table auth.mfa_factors(id uuid primary key,user_id uuid,status text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal1'))$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;`,
  );
  try {
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql") && f <= last)
      .sort())
      await db.exec(
        (await readFile("supabase/migrations/" + file, "utf8")).replace(
          "create extension if not exists pgcrypto;",
          "",
        ),
      );
  } catch (error) {
    await db.close();
    throw error;
  }
  return db;
}
export async function asUser(db: PGlite, id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
