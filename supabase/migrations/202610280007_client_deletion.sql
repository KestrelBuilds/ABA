begin;
alter table public.clients add column deletion_pending boolean not null default false;
-- Retry state is private, survives storage errors, and is removed after successful cleanup.
create table public.client_deletions (
 client_id uuid primary key,
 project_ids uuid[] not null,
 files jsonb not null check(jsonb_typeof(files)='array'),
 started_by uuid not null references auth.users(id),
 started_at timestamptz not null default now()
);
alter table public.client_deletions enable row level security;
revoke all on public.client_deletions from anon,authenticated;
grant select on public.client_deletions to authenticated;
create policy owner_client_deletions on public.client_deletions for select to authenticated using(public.is_admin());
create function public.client_deletion_ready() returns boolean language sql stable set search_path='' as $$select auth.uid() is not null$$;
-- Serialize metadata changes with deletion preparation so the frozen file list stays complete.
create function public.guard_client_deletion_write() returns trigger language plpgsql security definer set search_path='' as $$
declare new_client uuid;old_client uuid;candidate uuid;pending boolean;
begin
 if TG_TABLE_NAME in ('projects','invitations','profiles','client_billing') then
  new_client:=new.client_id;
  if TG_OP='UPDATE' then old_client:=old.client_id;end if;
 else
  select client_id into new_client from public.projects where id=new.project_id;
  if TG_OP='UPDATE' then select client_id into old_client from public.projects where id=old.project_id;end if;
 end if;
 for candidate in select distinct v from unnest(array[new_client,old_client]) v where v is not null order by v loop
  if auth.uid() is not null and not (public.is_admin() or public.owns_client(candidate) or exists(select 1 from public.invitations i where i.user_id=auth.uid() and i.client_id=candidate)) then raise exception 'Client access required';end if;
  select deletion_pending into pending from public.clients where id=candidate for update;
  if pending then raise exception 'Client deletion is in progress. Retry its cleanup before editing.';end if;
 end loop;
 return new;
end;$$;
create trigger guard_deleting_projects before insert or update on public.projects for each row execute function public.guard_client_deletion_write();
create trigger guard_deleting_documents before insert or update on public.documents for each row execute function public.guard_client_deletion_write();
create trigger guard_deleting_assets before insert or update on public.client_assets for each row execute function public.guard_client_deletion_write();
create trigger guard_deleting_invoices before insert or update on public.invoices for each row execute function public.guard_client_deletion_write();
create trigger guard_deleting_proposals before insert or update on public.proposals for each row execute function public.guard_client_deletion_write();
create trigger guard_deleting_invitations before insert or update on public.invitations for each row execute function public.guard_client_deletion_write();
create trigger guard_deleting_profiles before insert or update on public.profiles for each row execute function public.guard_client_deletion_write();
create trigger guard_deleting_billing before insert or update on public.client_billing for each row execute function public.guard_client_deletion_write();
create function public.guard_pending_client() returns trigger language plpgsql set search_path='' as $$begin if old.deletion_pending then raise exception 'Client deletion is in progress. Retry its cleanup before editing.';end if;return new;end;$$;
create trigger guard_pending_client before update on public.clients for each row execute function public.guard_pending_client();
-- Storage writes hold the same client lock until their database transaction completes.
create function public.client_storage_writable(target uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare pending boolean;
begin
 if not (public.is_admin() or exists(select 1 from public.projects p where p.id=target and public.owns_client(p.client_id))) then return false;end if;
 select c.deletion_pending into pending from public.clients c join public.projects p on p.client_id=c.id where p.id=target for update of c;
 return found and not pending;
end;$$;
drop policy aba_admin_upload on storage.objects;
create policy aba_admin_upload on storage.objects for insert to authenticated with check(bucket_id='project-files' and public.is_admin() and exists(select 1 from public.documents d where d.object_path=storage.objects.name and public.client_storage_writable(d.project_id)));
drop policy client_asset_upload on storage.objects;
create policy client_asset_upload on storage.objects for insert to authenticated with check(bucket_id='client-assets' and exists(select 1 from public.client_assets a where a.object_path=storage.objects.name and a.uploader_id=auth.uid() and public.client_storage_writable(a.project_id) and (public.can_access_project(a.project_id) or public.can_read_contract_asset(a.id))));
-- Also allow removal of orphaned objects, only from this frozen deletion manifest.
create policy owner_deletion_storage_read on storage.objects for select to authenticated using(public.is_admin() and exists(select 1 from public.client_deletions j cross join jsonb_array_elements(j.files) f where f->>'bucket'=bucket_id and f->>'path'=name));
create policy owner_deletion_storage_remove on storage.objects for delete to authenticated using(public.is_admin() and exists(select 1 from public.client_deletions j cross join jsonb_array_elements(j.files) f where f->>'bucket'=bucket_id and f->>'path'=name));

create function public.prepare_client_deletion(target uuid,confirmation text) returns jsonb language plpgsql security definer set search_path='' as $$
declare client public.clients;job public.client_deletions;projects uuid[];files jsonb;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 select * into client from public.clients where id=target for update;
 if not found then raise exception 'Client not found';end if;
 if confirmation is distinct from client.name then raise exception 'Type the exact client business name to confirm deletion';end if;
 select * into job from public.client_deletions where client_id=target;
 if found then return jsonb_set(to_jsonb(job),'{files}',coalesce((select jsonb_agg(f.value) from jsonb_array_elements(job.files) f where exists(select 1 from storage.objects o where o.bucket_id=f.value->>'bucket' and o.name=f.value->>'path')),'[]'::jsonb));end if;
 if exists(select 1 from public.invoices i join public.projects p on p.id=i.project_id where p.client_id=target) or exists(select 1 from public.proposals r join public.projects p on p.id=r.project_id where p.client_id=target) then raise exception 'This client has generated financial records. Keep its history and revoke access instead.';end if;
 select coalesce(array_agg(id),'{}'::uuid[]) into projects from public.projects where client_id=target;
 update public.clients set deletion_pending=true where id=target;
 -- Revoke profiles/invitations in the same transaction. Auth accounts and audit references remain.
 delete from public.profiles where role='client' and client_id=target;
 delete from public.invitations where client_id=target;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',f.bucket,'path',f.path) order by f.bucket,f.path),'[]'::jsonb) into files from (
  select 'project-files'::text bucket,object_path path from public.documents where project_id=any(projects)
  union select 'client-assets',object_path from public.client_assets where project_id=any(projects)
  union select bucket_id,name from storage.objects where bucket_id in ('project-files','client-assets') and split_part(name,'/',1)=any(projects::text[])
 ) f;
 insert into public.client_deletions(client_id,project_ids,files,started_by) values(target,projects,files,auth.uid()) returning * into job;
 insert into public.audit_events(actor_id,entity,entity_id,action)values(auth.uid(),'clients',target,'deletion_started');
 return jsonb_set(to_jsonb(job),'{files}',coalesce((select jsonb_agg(f.value) from jsonb_array_elements(job.files) f where exists(select 1 from storage.objects o where o.bucket_id=f.value->>'bucket' and o.name=f.value->>'path')),'[]'::jsonb));
end;$$;
create function public.finish_client_deletion(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare job public.client_deletions;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 perform 1 from public.clients where id=target for update;
 if not found then return;end if;
 select * into job from public.client_deletions where client_id=target for update;
 if not found then raise exception 'Prepare client deletion first';end if;
 if exists(select 1 from storage.objects o cross join jsonb_array_elements(job.files) f where o.bucket_id=f->>'bucket' and o.name=f->>'path') then raise exception 'Private file cleanup is incomplete. Retry deletion.';end if;
 if exists(select 1 from public.invoices i join public.projects p on p.id=i.project_id where p.client_id=target) or exists(select 1 from public.proposals r join public.projects p on p.id=r.project_id where p.client_id=target) then raise exception 'Financial records prevent deletion';end if;
 delete from public.profiles where role='client' and client_id=target;
 delete from public.invitations where client_id=target;
 -- Returns reference contracts; exchanges reference stages. Remove in dependency order.
 delete from public.client_assets where project_id=any(job.project_ids);
 delete from public.contract_exchanges where project_id=any(job.project_ids);
 delete from public.projects where client_id=target;
 delete from public.client_billing where client_id=target;
 delete from public.clients where id=target;
 delete from public.client_deletions where client_id=target;
 insert into public.audit_events(actor_id,entity,entity_id,action)values(auth.uid(),'clients',target,'deleted');
end;$$;
revoke all on function public.client_deletion_ready(),public.guard_client_deletion_write(),public.guard_pending_client(),public.client_storage_writable(uuid),public.prepare_client_deletion(uuid,text),public.finish_client_deletion(uuid) from public;
grant execute on function public.client_deletion_ready(),public.client_storage_writable(uuid),public.prepare_client_deletion(uuid,text),public.finish_client_deletion(uuid) to authenticated;
commit;
