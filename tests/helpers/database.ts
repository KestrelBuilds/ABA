import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
export async function testDatabase(through = 9) {
  const db = new PGlite();
  await db.exec(
    `create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.mfa_factors(id uuid primary key,user_id uuid,status text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select '{"aal":"aal1"}'::jsonb$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;`,
  );
  for (const name of [
    "202610270001_workspace.sql",
    "202610270002_storage.sql",
    "202610270003_owner_mfa.sql",
    "202610280004_project_management.sql",
    "202610280005_business_documents.sql",
    "202610280006_contract_area.sql",
    "202610280007_client_deletion.sql",
    "202610290008_prospect_spaces.sql",
    "202610290009_enquiries.sql",
  ].slice(0, through))
    await db.exec(
      (await readFile("supabase/migrations/" + name, "utf8")).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
  return db;
}
