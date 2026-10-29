-- One-time setup for the prospective-client flow and Tally inbox.
-- Applies only missing upgrades 007/008/009; existing records/flags are preserved.
-- Canonical migrations remain under supabase/migrations. Requires migration 006.
begin;
do $prerequisite$ begin
 if to_regprocedure('public.contract_area_ready()') is null then raise exception 'Apply the 006 contract-area migration first';end if;
end;$prerequisite$;

do $apply_7$ begin
 if to_regclass('public.client_deletions') is null then
  execute $upgrade_7$
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
$upgrade_7$;
 elsif to_regprocedure('public.client_deletion_ready()') is null then
  raise exception 'Incomplete client_deletions setup detected; no changes were committed';
 end if;
end;$apply_7$;

do $apply_8$ begin
 if to_regclass('public.prospect_spaces') is null then
  execute $upgrade_8$
create table public.prospect_spaces (
 project_id uuid primary key references public.projects(id) on delete cascade,
 enabled boolean not null default false,
 release_step text not null default 'discovery' check(release_step in ('discovery','proposal','agreement')),
 enquiry_status text not null default 'new' check(enquiry_status in ('new','discovery','proposal','considering','closed')),
 booking_url text not null default 'https://calendly.com/alex-bell-arts/new-meeting' check(booking_url ~ '^https://(www\.)?calendly\.com/[^[:space:]?#]+([?#].*)?$'),
 proposal_stage_id uuid references public.stages(id) on delete restrict,
 contract_stage_id uuid references public.stages(id) on delete restrict,
 invoice_stage_id uuid references public.stages(id) on delete restrict
);
alter table public.prospect_spaces enable row level security;
revoke all on public.prospect_spaces from anon,authenticated;
grant select on public.prospect_spaces to authenticated;
create policy owner_prospect_spaces on public.prospect_spaces for select to authenticated using(public.is_admin());
create trigger guard_deleting_prospects before insert or update on public.prospect_spaces for each row execute function public.guard_client_deletion_write();
create function public.validate_prospect_stages() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from unnest(array[new.proposal_stage_id,new.contract_stage_id,new.invoice_stage_id]) v where v is not null and not exists(select 1 from public.stages s where s.id=v and s.project_id=new.project_id)) then raise exception 'All selected stages must belong to this project';end if;
 if new.enquiry_status='closed' and exists(select 1 from public.projects where id=new.project_id and contract_signed and deposit_paid) then raise exception 'Use project completion or revocation for an active client';end if;
 return new;end;$$;
create trigger validate_prospect_stages before insert or update on public.prospect_spaces for each row execute function public.validate_prospect_stages();
create function public.audit_prospect_space() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.audit_events(actor_id,entity,entity_id,action)values(auth.uid(),'prospect_spaces',new.project_id,lower(TG_OP));return new;end;$$;
create trigger audit_prospect_space after insert or update on public.prospect_spaces for each row execute function public.audit_prospect_space();
create function public.prospect_spaces_ready() returns boolean language sql stable set search_path='' as $$select auth.uid() is not null$$;
create function public.set_prospect_space(target uuid,shared boolean,step text,status text,booking text,proposal_stage uuid,contract_stage uuid,invoice_stage uuid) returns void language plpgsql security invoker set search_path='' as $$begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 insert into public.prospect_spaces(project_id,enabled,release_step,enquiry_status,booking_url,proposal_stage_id,contract_stage_id,invoice_stage_id)values(target,shared,step,status,booking,proposal_stage,contract_stage,invoice_stage)
 on conflict(project_id) do update set enabled=excluded.enabled,release_step=excluded.release_step,enquiry_status=excluded.enquiry_status,booking_url=excluded.booking_url,proposal_stage_id=excluded.proposal_stage_id,contract_stage_id=excluded.contract_stage_id,invoice_stage_id=excluded.invoice_stage_id;
end;$$;
-- Only the owner RPC can change this owner-owned table; RLS rechecks ownership too.
grant insert,update on public.prospect_spaces to authenticated;
create policy owner_prospect_changes on public.prospect_spaces for all to authenticated using(public.is_admin()) with check(public.is_admin());
create function public.can_read_prospect_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d join public.projects p on p.id=d.project_id join public.prospect_spaces x on x.project_id=p.id join public.stages s on s.id=d.stage_id and s.project_id=p.id
 where d.id=target and public.owns_client(p.client_id) and x.enabled and x.enquiry_status<>'closed' and s.visible and d.published and d.category='document' and (
 (x.release_step in ('proposal','agreement') and d.document_role='Proposal' and d.stage_id=x.proposal_stage_id) or
 (x.release_step='agreement' and ((d.document_role='Contract' and d.stage_id=x.contract_stage_id) or (d.document_role='Invoice' and d.stage_id=x.invoice_stage_id)))));
$$;
create or replace function public.can_read_contract_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d where d.id=target and d.document_role='Contract' and public.can_read_prospect_document(d.id)) or exists(
 select 1 from public.documents d join public.contract_exchanges x on x.project_id=d.project_id and x.stage_id=d.stage_id join public.stages s on s.id=x.stage_id and s.project_id=x.project_id join public.projects p on p.id=x.project_id
 where d.id=target and not exists(select 1 from public.prospect_spaces where project_id=p.id) and x.enabled and s.visible and d.published and d.category='document' and d.document_role='Contract' and public.owns_client(p.client_id));
$$;
create or replace function public.can_read_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.can_read_contract_document(target) or public.can_read_prospect_document(target) or exists(select 1 from public.documents d join public.projects p on p.id=d.project_id where d.id=target and
 (public.is_admin() or (public.can_access_project(p.id) and d.published and (d.category<>'final' or (p.final_paid and p.final_approved)) and (d.stage_id is null or exists(select 1 from public.stages s where s.id=d.stage_id and s.visible)))));
$$;
create table public.proposal_responses (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,
 document_id uuid not null references public.documents(id) on delete cascade,actor_id uuid not null references auth.users(id),
 decision text not null check(decision in ('interested','question','declined')),message text not null default '' check(length(message)<=2000),
 created_at timestamptz not null default now(),unique(document_id,actor_id)
);
alter table public.proposal_responses enable row level security;
revoke all on public.proposal_responses from anon,authenticated;
grant select,insert on public.proposal_responses to authenticated;
create policy owner_proposal_responses on public.proposal_responses for select to authenticated using(public.is_admin());
create policy client_proposal_responses on public.proposal_responses for select to authenticated using(actor_id=auth.uid() and public.can_read_prospect_document(document_id));
create policy client_proposal_response_insert on public.proposal_responses for insert to authenticated with check(actor_id=auth.uid() and public.can_read_prospect_document(document_id) and exists(select 1 from public.documents d where d.id=document_id and d.project_id=proposal_responses.project_id and d.document_role='Proposal'));
create trigger guard_deleting_responses before insert on public.proposal_responses for each row execute function public.guard_client_deletion_write();
create trigger audit_proposal_responses after insert on public.proposal_responses for each row execute function public.record_audit();
-- Old contract URLs/DTOs cannot reveal contract metadata before the new agreement release.
create or replace function public.contract_area(target uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('project_id',p.id,'name',p.name,'stage_id',s.id,'stage_name',s.name,'contract_signed',p.contract_signed,'deposit_paid',p.deposit_paid,
 'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'version_label',d.version_label) order by d.created_at),'[]'::jsonb) from public.documents d where d.project_id=p.id and d.stage_id=s.id and d.published and d.category='document' and d.document_role='Contract'),
 'returns',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'contract_document_id',a.contract_document_id,'created_at',a.created_at) order by a.created_at),'[]'::jsonb) from public.client_assets a join public.documents d on d.id=a.contract_document_id where a.project_id=p.id and a.stage_id=s.id and d.project_id=p.id and d.stage_id=s.id and d.published and d.category='document' and d.document_role='Contract' and (public.is_admin() or a.uploader_id=auth.uid()))
 ) order by p.created_at),'[]'::jsonb) from public.contract_exchanges x join public.projects p on p.id=x.project_id join public.stages s on s.id=x.stage_id and s.project_id=p.id
 where x.enabled and s.visible and not exists(select 1 from public.prospect_spaces where project_id=p.id) and (target is null or p.id=target) and (public.owns_client(p.client_id) or (public.is_admin() and target is not null));
$$;
create function public.prospect_area(target uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('project_id',p.id,'name',p.name,'enabled',x.enabled,'release_step',x.release_step,'enquiry_status',x.enquiry_status,'booking_url',x.booking_url,'contract_signed',p.contract_signed,'deposit_paid',p.deposit_paid,
 'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'version_label',d.version_label,'document_role',d.document_role) order by d.created_at),'[]'::jsonb) from public.documents d join public.stages s on s.id=d.stage_id and s.project_id=p.id where d.project_id=p.id and x.enabled and x.enquiry_status<>'closed' and d.published and d.category='document' and s.visible and (
 (x.release_step in ('proposal','agreement') and d.document_role='Proposal' and d.stage_id=x.proposal_stage_id) or (x.release_step='agreement' and ((d.document_role='Contract' and d.stage_id=x.contract_stage_id) or (d.document_role='Invoice' and d.stage_id=x.invoice_stage_id))))),
 'returns',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'contract_document_id',a.contract_document_id,'created_at',a.created_at) order by a.created_at),'[]'::jsonb) from public.client_assets a join public.documents d on d.id=a.contract_document_id join public.stages s on s.id=d.stage_id and s.project_id=p.id where a.project_id=p.id and d.project_id=p.id and x.enabled and x.enquiry_status<>'closed' and x.release_step='agreement' and s.visible and d.published and d.category='document' and d.document_role='Contract' and d.stage_id=x.contract_stage_id and (public.is_admin() or a.uploader_id=auth.uid())),
 'responses',(select coalesce(jsonb_agg(jsonb_build_object('document_id',r.document_id,'decision',r.decision,'message',r.message)),'[]'::jsonb) from public.proposal_responses r where r.project_id=p.id and (public.is_admin() or r.actor_id=auth.uid()))
 ) order by p.created_at),'[]'::jsonb) from public.prospect_spaces x join public.projects p on p.id=x.project_id where (target is null or p.id=target) and ((public.owns_client(p.client_id) and x.enabled and x.enquiry_status<>'closed') or (public.is_admin() and target is not null));
$$;
create or replace function public.client_invitation_ready(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() and exists(select 1 from public.projects p join public.clients c on c.id=p.client_id where p.client_id=target and not c.deletion_pending and ((p.contract_signed and p.deposit_paid) or exists(select 1 from public.prospect_spaces x where x.project_id=p.id and x.enabled and x.enquiry_status<>'closed') or (not exists(select 1 from public.prospect_spaces where project_id=p.id) and exists(select 1 from public.contract_exchanges x join public.stages s on s.id=x.stage_id and s.project_id=x.project_id join public.documents d on d.stage_id=s.id and d.project_id=x.project_id where x.project_id=p.id and x.enabled and s.visible and d.published and d.category='document' and d.document_role='Contract'))));
$$;
create or replace function public.accept_invitation() returns void language plpgsql security definer set search_path='' as $$
declare invitation public.invitations;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into invitation from public.invitations where user_id=auth.uid() and accepted_at is null for update;if not found then return;end if;
 if not exists(select 1 from public.projects p join public.clients c on c.id=p.client_id where p.client_id=invitation.client_id and not c.deletion_pending and ((p.contract_signed and p.deposit_paid) or exists(select 1 from public.prospect_spaces x where x.project_id=p.id and x.enabled and x.enquiry_status<>'closed') or (not exists(select 1 from public.prospect_spaces where project_id=p.id) and exists(select 1 from public.contract_exchanges x join public.stages s on s.id=x.stage_id and s.project_id=x.project_id join public.documents d on d.stage_id=s.id and d.project_id=x.project_id where x.project_id=p.id and x.enabled and s.visible and d.published and d.category='document' and d.document_role='Contract')))) then raise exception 'No shared enquiry or onboarded project is available';end if;
 insert into public.profiles(id,role,client_id)values(auth.uid(),'client',invitation.client_id);update public.invitations set accepted_at=now() where id=invitation.id;
 insert into public.audit_events(actor_id,entity,entity_id,action)values(auth.uid(),'invitations',invitation.id,'accepted');end;$$;
-- Deletion must release stage bindings before cascading project/stage rows.
create or replace function public.finish_client_deletion(target uuid) returns void language plpgsql security definer set search_path='' as $$declare job public.client_deletions;begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 perform 1 from public.clients where id=target for update;if not found then return;end if;
 select * into job from public.client_deletions where client_id=target for update;if not found then raise exception 'Prepare client deletion first';end if;
 if exists(select 1 from storage.objects o cross join jsonb_array_elements(job.files) f where o.bucket_id=f->>'bucket' and o.name=f->>'path') then raise exception 'Private file cleanup is incomplete. Retry deletion.';end if;
 if exists(select 1 from public.invoices i join public.projects p on p.id=i.project_id where p.client_id=target) or exists(select 1 from public.proposals r join public.projects p on p.id=r.project_id where p.client_id=target) then raise exception 'Financial records prevent deletion';end if;
 delete from public.profiles where role='client' and client_id=target;delete from public.invitations where client_id=target;
 delete from public.client_assets where project_id=any(job.project_ids);delete from public.contract_exchanges where project_id=any(job.project_ids);delete from public.prospect_spaces where project_id=any(job.project_ids);
 delete from public.projects where client_id=target;delete from public.client_billing where client_id=target;delete from public.clients where id=target;delete from public.client_deletions where client_id=target;
 insert into public.audit_events(actor_id,entity,entity_id,action)values(auth.uid(),'clients',target,'deleted');end;$$;
revoke all on function public.validate_prospect_stages(),public.audit_prospect_space(),public.prospect_spaces_ready(),public.set_prospect_space(uuid,boolean,text,text,text,uuid,uuid,uuid),public.can_read_prospect_document(uuid),public.prospect_area(uuid) from public;
grant execute on function public.prospect_spaces_ready(),public.set_prospect_space(uuid,boolean,text,text,text,uuid,uuid,uuid),public.can_read_prospect_document(uuid),public.prospect_area(uuid) to authenticated;
$upgrade_8$;
 elsif to_regprocedure('public.prospect_spaces_ready()') is null then
  raise exception 'Incomplete prospect_spaces setup detected; no changes were committed';
 end if;
end;$apply_8$;

do $apply_9$ begin
 if to_regclass('public.enquiries') is null then
  execute $upgrade_9$
create table public.enquiries (
 id uuid primary key default gen_random_uuid(),source text not null check(source in ('tally','manual')),
 event_id text unique,form_id text,response_id text,received_at timestamptz not null default now(),
 business_name text not null default '' check(length(business_name)<=120),contact_name text not null default '' check(length(contact_name)<=120),email text not null default '' check(length(email)<=254),
 fields jsonb not null default '[]' check(jsonb_typeof(fields)='array' and pg_column_size(fields)<=65536),
 status text not null default 'new' check(status in ('new','reviewing','converted','closed')),
 linked_client_id uuid references public.clients(id) on delete set null,linked_project_id uuid references public.projects(id) on delete set null,
 unique(form_id,response_id),check(source<>'tally' or (event_id is not null and form_id is not null and response_id is not null))
);
alter table public.enquiries enable row level security;
revoke all on public.enquiries from anon,authenticated;
grant select,insert,update on public.enquiries to authenticated;
create policy owner_enquiries on public.enquiries for all to authenticated using(public.is_admin()) with check(public.is_admin());
do $$begin if exists(select 1 from pg_roles where rolname='service_role')then execute 'grant select,insert on public.enquiries to service_role';end if;end;$$;
create trigger audit_enquiries after insert or update or delete on public.enquiries for each row execute function public.record_audit();
-- Minimal non-contact receipts prevent retries from recreating deliberately deleted enquiry content.
create table public.tally_receipts(form_id text not null,response_id text not null,event_id text not null unique,received_at timestamptz not null default now(),primary key(form_id,response_id));
alter table public.tally_receipts enable row level security;
revoke all on public.tally_receipts from anon,authenticated;
grant select on public.tally_receipts to authenticated;
create policy owner_tally_receipts on public.tally_receipts for select to authenticated using(public.is_admin());
create function public.ingest_tally_enquiry(payload jsonb) returns void language plpgsql security invoker set search_path='' as $$declare receipt text;begin
 insert into public.tally_receipts(form_id,response_id,event_id)values(payload->>'form_id',payload->>'response_id',payload->>'event_id')on conflict(form_id,response_id)do nothing returning response_id into receipt;
 if not found then return;end if;
 insert into public.enquiries(source,event_id,form_id,response_id,business_name,contact_name,email,fields)values('tally',payload->>'event_id',payload->>'form_id',payload->>'response_id',coalesce(payload->>'business_name',''),coalesce(payload->>'contact_name',''),coalesce(payload->>'email',''),coalesce(payload->'fields','[]'::jsonb));
end;$$;
revoke all on function public.ingest_tally_enquiry(jsonb) from public;
do $$begin if exists(select 1 from pg_roles where rolname='service_role')then execute 'grant select,insert on public.tally_receipts to service_role';execute 'grant execute on function public.ingest_tally_enquiry(jsonb) to service_role';end if;end;$$;
create function public.enquiries_ready() returns boolean language sql stable set search_path='' as $$select auth.uid() is not null$$;
create function public.convert_enquiry(target uuid,business text,contact text,address text,sector_name text,project_name text,project_type text,due_date date,project_budget numeric,template jsonb,existing_client uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare enquiry public.enquiries;client uuid;project uuid;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 select * into enquiry from public.enquiries where id=target for update;if not found then raise exception 'Enquiry not found';end if;
 if enquiry.status='converted' or enquiry.linked_project_id is not null then raise exception 'This enquiry has already been converted';end if;
 if existing_client is null then insert into public.clients(name,contact,email,sector)values(business,contact,address,sector_name) returning id into client;
 else select id into client from public.clients where id=existing_client and not deletion_pending;if not found then raise exception 'Client unavailable';end if;end if;
 project:=public.create_project(project_name,client,project_type,due_date,project_budget,template);
 insert into public.prospect_spaces(project_id)values(project);
 update public.enquiries set status='converted',linked_client_id=client,linked_project_id=project where id=target;
 return project;
end;$$;
-- A confirmed client deletion also removes its converted enquiry content, retaining audit events.
create function public.delete_linked_enquiries() returns trigger language plpgsql security definer set search_path='' as $$begin delete from public.enquiries where linked_client_id=old.id;return old;end;$$;
create trigger delete_linked_enquiries before delete on public.clients for each row execute function public.delete_linked_enquiries();
revoke all on function public.enquiries_ready(),public.convert_enquiry(uuid,text,text,text,text,text,text,date,numeric,jsonb,uuid),public.delete_linked_enquiries() from public;
grant execute on function public.enquiries_ready(),public.convert_enquiry(uuid,text,text,text,text,text,text,date,numeric,jsonb,uuid) to authenticated;
$upgrade_9$;
 elsif to_regprocedure('public.enquiries_ready()') is null then
  raise exception 'Incomplete enquiries setup detected; no changes were committed';
 end if;
end;$apply_9$;
commit;
