-- Apply after 012 only when the approved scanner and server-only worker key
-- are configured. Existing files retain legacy access; every NEW file is
-- quarantined until a server-side size/hash/content/malware check succeeds.
begin;
alter table public.documents
 add column scan_state text not null default 'legacy' check(scan_state in ('legacy','pending','clean','rejected')),
 add column file_size bigint,
 add column sha256 text,
 add column content_type text,
 add column scanned_at timestamptz;
alter table public.documents alter column scan_state set default 'pending';
create policy scanned_metadata on public.documents as restrictive for select to authenticated
 using(public.is_admin() or scan_state in ('legacy','clean'));
alter table public.client_assets
 add column scan_state text not null default 'legacy' check(scan_state in ('legacy','pending','clean','rejected')),
 add column file_size bigint,
 add column sha256 text,
 add column content_type text,
 add column scanned_at timestamptz;
alter table public.client_assets alter column scan_state set default 'pending';
create policy scanned_metadata on public.client_assets as restrictive for select to authenticated
 using(public.is_admin() or scan_state in ('legacy','clean'));

create table public.upload_intakes (
 id uuid primary key,
 project_id uuid not null references public.projects(id) on delete cascade,
 stage_id uuid references public.stages(id) on delete restrict,
 user_id uuid references auth.users(id) on delete set null,
 kind text not null check(kind in ('document','asset','contract')),
 bucket text not null check(bucket in ('project-files','client-assets')),
 object_path text not null unique,
 name text not null check(length(name) between 1 and 180),
 expected_size bigint not null check(expected_size between 1 and 26214400),
 expected_sha256 text not null check(expected_sha256 ~ '^[a-f0-9]{64}$'),
 content_type text not null,
 status text not null default 'pending' check(status in ('pending','clean','rejected')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '2 hours'),
 checked_at timestamptz,
 discarded_at timestamptz,
 check(object_path=project_id::text||'/'||id::text)
);
alter table public.upload_intakes enable row level security;
revoke all on public.upload_intakes from anon,authenticated;
grant select on public.upload_intakes to authenticated;
create policy intake_status on public.upload_intakes for select to authenticated
 using(public.is_admin() or (user_id=auth.uid() and public.project_client_access_enabled(project_id)));
create index on public.upload_intakes(project_id,status);

create function public.guard_file_scan() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  if new.scan_state<>'pending' or new.scanned_at is not null then raise exception 'New uploads require a security check';end if;
 elsif new.id is distinct from old.id or new.project_id is distinct from old.project_id or new.object_path is distinct from old.object_path then
  raise exception 'Upload a new file instead of replacing checked bytes';
 elsif new.scan_state is distinct from old.scan_state or new.file_size is distinct from old.file_size
 or new.sha256 is distinct from old.sha256 or new.content_type is distinct from old.content_type or new.scanned_at is distinct from old.scanned_at then
  if coalesce(current_setting('aba.upload_worker',true),'')<>'checking' then raise exception 'Only the upload checker can update file security state';end if;
 end if;
 if TG_TABLE_NAME='documents' then
  if new.published and new.scan_state not in ('legacy','clean') then raise exception 'Check this file before sharing it';end if;
 end if;
 return new;
end;$$;
create trigger guard_file_scan before insert or update on public.documents for each row execute function public.guard_file_scan();
create trigger guard_file_scan before insert or update on public.client_assets for each row execute function public.guard_file_scan();
create policy reserved_document on public.documents as restrictive for insert to authenticated with check(exists(select 1 from public.upload_intakes u where u.id=documents.id and u.project_id=documents.project_id and u.user_id=auth.uid() and u.status='pending'));
create policy reserved_asset on public.client_assets as restrictive for insert to authenticated with check(exists(select 1 from public.upload_intakes u where u.id=client_assets.id and u.project_id=client_assets.project_id and u.user_id=auth.uid() and u.status='pending'));

create or replace function public.can_read_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d join public.projects p on p.id=d.project_id where d.id=target and d.scan_state in ('legacy','clean') and
 (public.is_admin() or (public.project_client_access_enabled(p.id) and
 (public.can_read_contract_document(target) or public.can_read_prospect_document(target) or
 (public.can_access_project(p.id) and d.published and (d.category<>'final' or (p.final_paid and p.final_approved))
 and (d.stage_id is null or exists(select 1 from public.stages s where s.id=d.stage_id and s.visible)))))));
$$;
create policy owner_assets_metadata on public.client_assets for select to authenticated using(public.is_admin());

-- No direct download (including owner signed URLs) can read quarantine bytes.
create policy scanned_storage on storage.objects as restrictive for select to authenticated using(
 (bucket_id not in ('project-files','client-assets')) or
 (bucket_id='project-files' and exists(select 1 from public.documents d where d.object_path=storage.objects.name and d.scan_state in ('legacy','clean'))) or
 (bucket_id='client-assets' and exists(select 1 from public.client_assets a where a.object_path=storage.objects.name and a.scan_state in ('legacy','clean')))
);
-- Checked objects cannot be removed/replaced with a still-live upload token.
-- Quarantine/client deletion uses only the scoped server worker.
create policy checked_bytes_delete on storage.objects as restrictive for delete to authenticated using(
 (bucket_id not in ('project-files','client-assets')) or
 (bucket_id='project-files' and exists(select 1 from public.documents d where d.object_path=storage.objects.name and d.scan_state='legacy')) or
 (bucket_id='client-assets' and exists(select 1 from public.client_assets a where a.object_path=storage.objects.name and a.scan_state='legacy'))
);
create policy checked_bytes_update on storage.objects as restrictive for update to authenticated using(bucket_id not in ('project-files','client-assets')) with check(bucket_id not in ('project-files','client-assets'));
drop policy aba_admin_upload on storage.objects;
drop policy client_asset_upload on storage.objects;
create policy reserved_storage_upload on storage.objects for insert to authenticated with check(
 exists(select 1 from public.upload_intakes u where u.bucket=bucket_id and u.object_path=storage.objects.name
 and u.user_id=auth.uid() and u.status='pending' and u.expires_at>now() and public.client_storage_writable(u.project_id))
);
update storage.buckets set file_size_limit=26214400,
 allowed_mime_types=array['application/pdf','image/png','image/jpeg','image/webp','application/postscript','application/illustrator','application/zip','application/x-zip-compressed','application/octet-stream']
 where id in ('project-files','client-assets');

create function public.reserve_file_upload(target uuid,upload_id uuid,upload_kind text,file_name text,file_size bigint,file_hash text,mime text,stage uuid default null,category_name text default 'document',role_name text default 'General',version text default 'v1',review_date date default null,original_contract uuid default null)
 returns void language plpgsql security definer set search_path='' as $$
declare p public.projects; d public.documents; bucket_name text;
begin
 if auth.uid() is null or upload_id is null or upload_kind is null or upload_kind not in ('document','asset','contract') then raise exception 'Sign in and choose a valid upload';end if;
 select * into p from public.projects where id=target for update;
 if not found or p.archived_at is not null or not public.project_client_writable(target) then raise exception 'This project is not available for uploads';end if;
 if upload_kind='document' and not public.is_admin() then raise exception 'Owner access required';end if;
 if upload_kind='asset' and not public.can_access_project(target) then raise exception 'Project access required';end if;
 if (select count(*) from public.upload_intakes where project_id=target and user_id=auth.uid() and status='pending' and expires_at>now())>=5 then raise exception 'Finish or discard pending uploads before adding more';end if;
 if file_name is null or length(file_name) not between 1 and 180 or file_name ~ '[\\/]' or file_size is null or file_size not between 1 and 26214400
 or file_hash is null or file_hash !~ '^[a-f0-9]{64}$' then raise exception 'Check file name, size and checksum';end if;
 if stage is not null and not exists(select 1 from public.stages where id=stage and project_id=target and (visible or public.is_admin())) then raise exception 'Choose an available stage in this project';end if;
 if upload_kind='contract' then
  if public.is_admin() or not public.can_return_contract_document(original_contract,target,stage) then raise exception 'Use a client account and the original contract reference';end if;
  if file_size>3145728 or mime<>'application/pdf' then raise exception 'Contract returns must be PDFs up to 3 MB';end if;
 end if;
 if mime is null or mime not in ('application/pdf','image/png','image/jpeg','image/webp','application/postscript','application/zip') then raise exception 'Choose a supported file type';end if;
 bucket_name:=case when upload_kind='document' then 'project-files' else 'client-assets' end;
 insert into public.upload_intakes(id,project_id,stage_id,user_id,kind,bucket,object_path,name,expected_size,expected_sha256,content_type)
 values(upload_id,target,stage,auth.uid(),upload_kind,bucket_name,target::text||'/'||upload_id::text,file_name,file_size,file_hash,mime);
 if upload_kind='document' then
  insert into public.documents(id,project_id,stage_id,name,object_path,category,document_role,version_label,review_due,scan_state)
  values(upload_id,target,stage,file_name,target::text||'/'||upload_id::text,category_name,role_name,version,review_date,'pending');
 else
  insert into public.client_assets(id,project_id,stage_id,uploader_id,name,object_path,contract_document_id,scan_state)
  values(upload_id,target,stage,auth.uid(),file_name,target::text||'/'||upload_id::text,case when upload_kind='contract' then original_contract else null end,'pending');
 end if;
end;$$;

create function public.file_intake_for_check(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u public.upload_intakes;
begin
 select * into u from public.upload_intakes where id=target;
 if not found or u.discarded_at is not null or not (public.is_admin() or (u.user_id=auth.uid() and public.client_storage_writable(u.project_id))) then raise exception 'Upload not available';end if;
 return to_jsonb(u);
end;$$;

-- Called only by the narrowly scoped server worker after downloading the exact
-- reserved object, validating its bytes and receiving a hash-bound scan verdict.
create function public.complete_file_check(target uuid,verdict text,verified_size bigint,verified_hash text,verified_mime text) returns void language plpgsql security definer set search_path='' as $$
declare u public.upload_intakes;
begin
 select * into u from public.upload_intakes where id=target for update;
 if not found or u.discarded_at is not null or verdict is null or verdict not in ('clean','rejected') then raise exception 'Upload not available';end if;
 if u.status<>'pending' then return;end if;
 if not exists(select 1 from public.projects where id=u.project_id and archived_at is null) then raise exception 'Restore the project before checking uploads';end if;
 if verdict='clean' and (u.expires_at<=now() or verified_size is distinct from u.expected_size or verified_hash is distinct from u.expected_sha256 or verified_mime is distinct from u.content_type) then raise exception 'Upload did not match its reservation';end if;
 perform set_config('aba.upload_worker','checking',true);
 if u.kind='document' then
  update public.documents set scan_state=verdict,file_size=verified_size,sha256=verified_hash,content_type=verified_mime,scanned_at=now() where id=u.id and project_id=u.project_id;
 else
  update public.client_assets set scan_state=verdict,file_size=verified_size,sha256=verified_hash,content_type=verified_mime,scanned_at=now() where id=u.id and project_id=u.project_id;
 end if;
 update public.upload_intakes set status=verdict,checked_at=now() where id=target;
 perform set_config('aba.upload_worker','',true);
end;$$;

create function public.discard_file_intake(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare u public.upload_intakes;
begin
 select * into u from public.upload_intakes where id=target for update;
 if not found or u.discarded_at is not null or u.status='clean' then raise exception 'Only quarantined uploads can be discarded';end if;
 if exists(select 1 from storage.objects where bucket_id=u.bucket and name=u.object_path) then raise exception 'Remove quarantine bytes before its metadata';end if;
 if u.kind='document' then delete from public.documents where id=u.id;else delete from public.client_assets where id=u.id;end if;
 update public.upload_intakes set status='rejected',checked_at=coalesce(checked_at,now()),discarded_at=now() where id=u.id;
end;$$;

create function public.file_upload_cleanup_after(target uuid) returns timestamptz language sql stable security definer set search_path='' as $$
 select max(coalesce(u.checked_at,least(u.expires_at,j.started_at))+interval '2 hours 5 minutes')
 from public.client_deletions j join public.upload_intakes u on u.project_id=any(j.project_ids) where j.client_id=target;
$$;
create or replace function public.prepare_client_deletion(target uuid,confirmation text) returns jsonb language plpgsql security definer set search_path='' as $$
declare client public.clients;job public.client_deletions;projects uuid[];files jsonb;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 select * into client from public.clients where id=target for update;
 if not found then raise exception 'Client not found';end if;
 if confirmation is distinct from client.name then raise exception 'Type the exact client business name to confirm deletion';end if;
 select * into job from public.client_deletions where client_id=target;
 if found then return jsonb_set(to_jsonb(job),'{files}',coalesce((select jsonb_agg(f.value) from jsonb_array_elements(job.files) f where exists(select 1 from storage.objects o where o.bucket_id=f.value->>'bucket' and o.name=f.value->>'path')),'[]'::jsonb)) || jsonb_build_object('wait_until',public.file_upload_cleanup_after(target));end if;
 if exists(select 1 from public.invoices i join public.projects p on p.id=i.project_id where p.client_id=target) or exists(select 1 from public.proposals r join public.projects p on p.id=r.project_id where p.client_id=target) then raise exception 'This client has generated financial records. Keep its history and revoke access instead.';end if;
 select coalesce(array_agg(id),'{}'::uuid[]) into projects from public.projects where client_id=target;
 update public.clients set deletion_pending=true where id=target;
 -- Revoke profiles/invitations in the same transaction. Auth accounts and audit references remain.
 delete from public.profiles where role='client' and client_id=target;
 delete from public.invitations where client_id=target;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',f.bucket,'path',f.path) order by f.bucket,f.path),'[]'::jsonb) into files from (
  select 'project-files'::text bucket,object_path path from public.documents where project_id=any(projects)
  union select 'client-assets',object_path from public.client_assets where project_id=any(projects)
  union select bucket,object_path from public.upload_intakes where project_id=any(projects)
  union select bucket_id,name from storage.objects where bucket_id in ('project-files','client-assets') and split_part(name,'/',1)=any(projects::text[])
 ) f;
 insert into public.client_deletions(client_id,project_ids,files,started_by) values(target,projects,files,auth.uid()) returning * into job;
 insert into public.audit_events(actor_id,entity,entity_id,action)values(auth.uid(),'clients',target,'deletion_started');
 return jsonb_set(to_jsonb(job),'{files}',coalesce((select jsonb_agg(f.value) from jsonb_array_elements(job.files) f where exists(select 1 from storage.objects o where o.bucket_id=f.value->>'bucket' and o.name=f.value->>'path')),'[]'::jsonb)) || jsonb_build_object('wait_until',public.file_upload_cleanup_after(target));
end;$$;
create or replace function public.finish_client_deletion(target uuid) returns void language plpgsql security definer set search_path='' as $$declare job public.client_deletions;begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 perform 1 from public.clients where id=target for update;if not found then return;end if;
 select * into job from public.client_deletions where client_id=target for update;if not found then raise exception 'Prepare client deletion first';end if;
 if public.file_upload_cleanup_after(target)>now() then raise exception 'Private upload links must expire before final cleanup. Client access is revoked; retry later.';end if;
 if exists(select 1 from storage.objects o cross join jsonb_array_elements(job.files) f where o.bucket_id=f->>'bucket' and o.name=f->>'path') then raise exception 'Private file cleanup is incomplete. Retry deletion.';end if;
 if exists(select 1 from public.invoices i join public.projects p on p.id=i.project_id where p.client_id=target) or exists(select 1 from public.proposals r join public.projects p on p.id=r.project_id where p.client_id=target) then raise exception 'Financial records prevent deletion';end if;
 delete from public.profiles where role='client' and client_id=target;delete from public.invitations where client_id=target;
 delete from public.client_assets where project_id=any(job.project_ids);delete from public.contract_exchanges where project_id=any(job.project_ids);delete from public.prospect_spaces where project_id=any(job.project_ids);
 delete from public.projects where client_id=target;delete from public.client_billing where client_id=target;delete from public.clients where id=target;delete from public.client_deletions where client_id=target;
 insert into public.audit_events(actor_id,entity,entity_id,action)values(auth.uid(),'clients',target,'deleted');end;$$;
revoke all on function public.file_upload_cleanup_after(uuid) from public;

create or replace function public.contract_area(target uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('project_id',p.id,'archived_at',p.archived_at,'name',p.name,'stage_id',s.id,'stage_name',s.name,'contract_signed',p.contract_signed,'deposit_paid',p.deposit_paid,
 'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'version_label',d.version_label) order by d.created_at),'[]'::jsonb) from public.documents d where d.scan_state in ('legacy','clean') and d.project_id=p.id and d.stage_id=s.id and d.published and d.category='document' and d.document_role='Contract'),
 'returns',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'contract_document_id',a.contract_document_id,'created_at',a.created_at) order by a.created_at),'[]'::jsonb) from public.client_assets a join public.documents d on d.id=a.contract_document_id where a.scan_state in ('legacy','clean') and a.project_id=p.id and a.stage_id=s.id and d.project_id=p.id and d.stage_id=s.id and d.published and d.category='document' and d.document_role='Contract' and (public.is_admin() or a.uploader_id=auth.uid()))
 ) order by p.created_at),'[]'::jsonb) from public.contract_exchanges x join public.projects p on p.id=x.project_id join public.stages s on s.id=x.stage_id and s.project_id=p.id
 where public.project_client_access_enabled(p.id) and x.enabled and s.visible and not exists(select 1 from public.prospect_spaces where project_id=p.id) and (target is null or p.id=target) and (public.owns_client(p.client_id) or (public.is_admin() and target is not null));
$$;

create or replace function public.prospect_area(target uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('project_id',p.id,'archived_at',p.archived_at,'name',p.name,'enabled',x.enabled,'release_step',x.release_step,'enquiry_status',x.enquiry_status,'booking_url',x.booking_url,'contract_signed',p.contract_signed,'deposit_paid',p.deposit_paid,
 'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'version_label',d.version_label,'document_role',d.document_role) order by d.created_at),'[]'::jsonb) from public.documents d join public.stages s on s.id=d.stage_id and s.project_id=p.id where d.scan_state in ('legacy','clean') and d.project_id=p.id and x.enabled and x.enquiry_status<>'closed' and d.published and d.category='document' and s.visible and (
 (x.release_step in ('proposal','agreement') and d.document_role='Proposal' and d.stage_id=x.proposal_stage_id) or (x.release_step='agreement' and ((d.document_role='Contract' and d.stage_id=x.contract_stage_id) or (d.document_role='Invoice' and d.stage_id=x.invoice_stage_id))))),
 'returns',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'contract_document_id',a.contract_document_id,'created_at',a.created_at) order by a.created_at),'[]'::jsonb) from public.client_assets a join public.documents d on d.id=a.contract_document_id join public.stages s on s.id=d.stage_id and s.project_id=p.id where a.scan_state in ('legacy','clean') and a.project_id=p.id and d.project_id=p.id and x.enabled and x.enquiry_status<>'closed' and x.release_step='agreement' and s.visible and d.published and d.category='document' and d.document_role='Contract' and d.stage_id=x.contract_stage_id and (public.is_admin() or a.uploader_id=auth.uid())),
 'responses',(select coalesce(jsonb_agg(jsonb_build_object('document_id',r.document_id,'decision',r.decision,'message',r.message)),'[]'::jsonb) from public.proposal_responses r where r.project_id=p.id and (public.is_admin() or r.actor_id=auth.uid()))
 ) order by p.created_at),'[]'::jsonb) from public.prospect_spaces x join public.projects p on p.id=x.project_id where public.project_client_access_enabled(p.id) and (target is null or p.id=target) and ((public.owns_client(p.client_id) and x.enabled and x.enquiry_status<>'closed') or (public.is_admin() and target is not null));
$$;

create function public.file_security_ready() returns boolean language sql stable set search_path='' as $$select true$$;
revoke all on function public.guard_file_scan(),public.reserve_file_upload(uuid,uuid,text,text,bigint,text,text,uuid,text,text,text,date,uuid),public.file_intake_for_check(uuid),public.complete_file_check(uuid,text,bigint,text,text),public.discard_file_intake(uuid),public.file_security_ready() from public;
grant execute on function public.reserve_file_upload(uuid,uuid,text,text,bigint,text,text,uuid,text,text,text,date,uuid),public.file_intake_for_check(uuid),public.file_security_ready() to authenticated;
grant execute on function public.complete_file_check(uuid,text,bigint,text,text),public.discard_file_intake(uuid) to service_role;
commit;
