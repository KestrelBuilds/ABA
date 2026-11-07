-- Apply once after 012. Optional 013 is NOT required and must stay deferred.
-- No stage completion, project verification, publication or client records are fabricated.
begin;
alter table public.stages add column client_uploads_allowed boolean not null default true;
update public.stages set client_uploads_allowed=false where lower(name) like '%goodbye%';
create function public.guard_goodbye_uploads() returns trigger language plpgsql set search_path='' as $$begin
 if lower(new.name) like '%goodbye%' then new.client_uploads_allowed:=false; end if;return new;
end;$$;
create trigger guard_goodbye_uploads before insert or update on public.stages for each row execute function public.guard_goodbye_uploads();

-- Stage metadata remains visible, while its contents are locked. Internal stages
-- also block later stages, without revealing their names to clients. Tie order is deterministic.
create function public.stage_client_unlocked(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.stages s join public.projects p on p.id=s.project_id where s.id=target and
 (public.is_admin() or (s.visible and public.owns_client(p.client_id) and public.project_client_access_enabled(p.id) and not exists(
 select 1 from public.stages previous where previous.project_id=p.id and (previous.position,previous.id)<(s.position,s.id) and not (
 case previous.purpose
 when 'contract' then p.contract_signed when 'deposit' then p.deposit_paid
 when 'contract_deposit' then p.contract_signed and p.deposit_paid
 when 'final_approval' then p.final_approved when 'final_payment' then p.final_paid
 else previous.status='Completed' end)))));
$$;
create function public.client_stage_access() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'unlocked',public.stage_client_unlocked(s.id)) order by s.position,s.id),'[]'::jsonb)
 from public.stages s where public.is_admin() or (s.visible and public.can_access_project(s.project_id));
$$;
create function public.stage_access_ready() returns boolean language sql stable set search_path='' as $$ select auth.uid() is not null $$;

create or replace function public.can_read_prospect_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d join public.projects p on p.id=d.project_id join public.prospect_spaces x on x.project_id=p.id join public.stages s on s.id=d.stage_id and s.project_id=p.id
 where coalesce(to_jsonb(d)->>'scan_state','legacy') in ('legacy','clean') and d.id=target and (public.owns_client(p.client_id) and public.project_client_access_enabled(p.id)) and x.enabled and x.enquiry_status<>'closed' and (s.visible and public.stage_client_unlocked(s.id)) and d.published and d.category='document' and (
 (x.release_step in ('proposal','agreement') and d.document_role='Proposal' and d.stage_id=x.proposal_stage_id) or
 (x.release_step='agreement' and ((d.document_role='Contract' and d.stage_id=x.contract_stage_id) or (d.document_role='Invoice' and d.stage_id=x.invoice_stage_id)))));
$$;

create or replace function public.can_read_contract_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d where coalesce(to_jsonb(d)->>'scan_state','legacy') in ('legacy','clean') and d.id=target and d.document_role='Contract' and public.can_read_prospect_document(d.id)) or exists(
 select 1 from public.documents d join public.contract_exchanges x on x.project_id=d.project_id and x.stage_id=d.stage_id join public.stages s on s.id=x.stage_id and s.project_id=x.project_id join public.projects p on p.id=x.project_id
 where coalesce(to_jsonb(d)->>'scan_state','legacy') in ('legacy','clean') and d.id=target and not exists(select 1 from public.prospect_spaces where project_id=p.id) and x.enabled and (s.visible and public.stage_client_unlocked(s.id)) and d.published and d.category='document' and d.document_role='Contract' and (public.owns_client(p.client_id) and public.project_client_access_enabled(p.id)));
$$;

create or replace function public.can_read_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d join public.projects p on p.id=d.project_id where coalesce(to_jsonb(d)->>'scan_state','legacy') in ('legacy','clean') and d.id=target and
 (public.is_admin() or (public.project_client_access_enabled(p.id) and
 (public.can_read_contract_document(target) or public.can_read_prospect_document(target) or
 (public.can_access_project(p.id) and d.published and (d.category<>'final' or (p.final_paid and p.final_approved))
 and (d.stage_id is null or exists(select 1 from public.stages s where s.id=d.stage_id and (s.visible and public.stage_client_unlocked(s.id)))))))));
$$;

create or replace function public.contract_area(target uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('project_id',p.id,'archived_at',p.archived_at,'name',p.name,'stage_id',s.id,'stage_name',s.name,'contract_signed',p.contract_signed,'deposit_paid',p.deposit_paid,
 'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'version_label',d.version_label) order by d.created_at),'[]'::jsonb) from public.documents d where coalesce(to_jsonb(d)->>'scan_state','legacy') in ('legacy','clean') and d.project_id=p.id and d.stage_id=s.id and d.published and d.category='document' and d.document_role='Contract'),
 'returns',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'contract_document_id',a.contract_document_id,'created_at',a.created_at) order by a.created_at),'[]'::jsonb) from public.client_assets a join public.documents d on d.id=a.contract_document_id where coalesce(to_jsonb(a)->>'scan_state','legacy') in ('legacy','clean') and a.project_id=p.id and a.stage_id=s.id and d.project_id=p.id and d.stage_id=s.id and d.published and d.category='document' and d.document_role='Contract' and (public.is_admin() or a.uploader_id=auth.uid()))
 ) order by p.created_at),'[]'::jsonb) from public.contract_exchanges x join public.projects p on p.id=x.project_id join public.stages s on s.id=x.stage_id and s.project_id=p.id
 where public.project_client_access_enabled(p.id) and x.enabled and (s.visible and public.stage_client_unlocked(s.id)) and not exists(select 1 from public.prospect_spaces where project_id=p.id) and (target is null or p.id=target) and (public.owns_client(p.client_id) or (public.is_admin() and target is not null));
$$;

create or replace function public.prospect_area(target uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('project_id',p.id,'archived_at',p.archived_at,'name',p.name,'enabled',x.enabled,'release_step',x.release_step,'enquiry_status',x.enquiry_status,'booking_url',x.booking_url,'contract_signed',p.contract_signed,'deposit_paid',p.deposit_paid,
 'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'version_label',d.version_label,'document_role',d.document_role) order by d.created_at),'[]'::jsonb) from public.documents d join public.stages s on s.id=d.stage_id and s.project_id=p.id where coalesce(to_jsonb(d)->>'scan_state','legacy') in ('legacy','clean') and d.project_id=p.id and x.enabled and x.enquiry_status<>'closed' and d.published and d.category='document' and (s.visible and public.stage_client_unlocked(s.id)) and (
 (x.release_step in ('proposal','agreement') and d.document_role='Proposal' and d.stage_id=x.proposal_stage_id) or (x.release_step='agreement' and ((d.document_role='Contract' and d.stage_id=x.contract_stage_id) or (d.document_role='Invoice' and d.stage_id=x.invoice_stage_id))))),
 'returns',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'contract_document_id',a.contract_document_id,'created_at',a.created_at) order by a.created_at),'[]'::jsonb) from public.client_assets a join public.documents d on d.id=a.contract_document_id join public.stages s on s.id=d.stage_id and s.project_id=p.id where coalesce(to_jsonb(a)->>'scan_state','legacy') in ('legacy','clean') and a.project_id=p.id and d.project_id=p.id and x.enabled and x.enquiry_status<>'closed' and x.release_step='agreement' and (s.visible and public.stage_client_unlocked(s.id)) and d.published and d.category='document' and d.document_role='Contract' and d.stage_id=x.contract_stage_id and (public.is_admin() or a.uploader_id=auth.uid())),
 'responses',(select coalesce(jsonb_agg(jsonb_build_object('document_id',r.document_id,'decision',r.decision,'message',r.message)),'[]'::jsonb) from public.proposal_responses r where r.project_id=p.id and (public.is_admin() or r.actor_id=auth.uid()))
 ) order by p.created_at),'[]'::jsonb) from public.prospect_spaces x join public.projects p on p.id=x.project_id where public.project_client_access_enabled(p.id) and (target is null or p.id=target) and ((public.owns_client(p.client_id) and x.enabled and x.enquiry_status<>'closed') or (public.is_admin() and target is not null));
$$;

-- Defence in depth for raw metadata, direct Storage, feedback and all upload paths.
create policy journey_resources on public.stage_resources as restrictive for select to authenticated using(public.is_admin() or public.stage_client_unlocked(stage_id));
create policy journey_assets_read on public.client_assets as restrictive for select to authenticated using(public.is_admin() or stage_id is null or public.stage_client_unlocked(stage_id));
create policy journey_assets_insert on public.client_assets as restrictive for insert to authenticated with check(public.is_admin() or stage_id is null or
 (public.stage_client_unlocked(stage_id) and exists(select 1 from public.stages s where s.id=stage_id and s.project_id=client_assets.project_id and s.client_uploads_allowed)));
create function public.journey_storage_open(bucket text,path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or case bucket
 when 'project-files' then exists(select 1 from public.documents d where d.object_path=path and public.can_read_document(d.id))
 when 'client-assets' then exists(select 1 from public.client_assets a where a.object_path=path and (a.stage_id is null or public.stage_client_unlocked(a.stage_id)))
 else true end;
$$;
create policy journey_storage_read on storage.objects as restrictive for select to authenticated using(public.journey_storage_open(bucket_id,name));
create policy journey_storage_insert on storage.objects as restrictive for insert to authenticated with check(public.is_admin() or bucket_id<>'client-assets' or exists(
 select 1 from public.client_assets a left join public.stages s on s.id=a.stage_id where a.object_path=storage.objects.name and a.uploader_id=auth.uid()
 and (a.stage_id is null or (public.stage_client_unlocked(a.stage_id) and s.client_uploads_allowed))));

-- Each service questionnaire belongs inside its journey stage; legacy/custom
-- workflows fall back to their first relevant stage instead of a parallel portal.
create function public.questionnaire_stage(target uuid,question_kind text) returns uuid language sql stable security definer set search_path='' as $$
 select s.id from public.stages s where s.project_id=target and (public.is_admin() or public.can_access_project(target)) order by
 case when question_kind='goodbye' then case when not s.client_uploads_allowed then 0 else 1 end
 when s.stream='Onboarding' and lower(btrim(s.name))='onboarding' then 0
 when s.stream=case when question_kind='website' then 'Website Design' else 'Brand Identity' end and lower(s.name) ~ '(discovery|questionnaire|brief)' and lower(s.name) !~ 'call' then 1
 when s.stream=case when question_kind='website' then 'Website Design' else 'Brand Identity' end then 2 else 3 end,
 case when question_kind='goodbye' and s.client_uploads_allowed then -s.position else s.position end,s.id limit 1;
$$;
create policy journey_handover_read on public.project_handover as restrictive for select to authenticated using(public.is_admin() or public.stage_client_unlocked(public.questionnaire_stage(project_id,'goodbye')));
create policy journey_questionnaires_read on public.questionnaires as restrictive for select to authenticated using(public.is_admin() or public.stage_client_unlocked(public.questionnaire_stage(project_id,kind)));
create policy journey_questionnaires_insert on public.questionnaires as restrictive for insert to authenticated with check(public.is_admin() or public.stage_client_unlocked(public.questionnaire_stage(project_id,kind)));

-- Extend only owner document Storage types; preserve existing size limits and privacy.
update storage.buckets set allowed_mime_types=case when allowed_mime_types is null then null else array(select distinct unnest(allowed_mime_types||array['application/postscript','image/svg+xml'])) end where id='project-files';

do $optional$ begin
 if to_regprocedure('public.file_security_ready()') is not null then
 execute $definition$create or replace function public.reserve_file_upload(target uuid,upload_id uuid,upload_kind text,file_name text,file_size bigint,file_hash text,mime text,stage uuid default null,category_name text default 'document',role_name text default 'General',version text default 'v1',review_date date default null,original_contract uuid default null)
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
 if mime is null or mime not in ('application/pdf','image/png','image/jpeg','image/webp','application/postscript','application/zip','image/svg+xml') then raise exception 'Choose a supported file type';end if;
 if mime='image/svg+xml' and (upload_kind<>'document' or not public.is_admin()) then raise exception 'SVG handovers are owner uploads only';end if;
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
end;$$;$definition$;
 end if;
end;$optional$;
revoke all on function public.guard_goodbye_uploads(),public.stage_client_unlocked(uuid),public.client_stage_access(),public.stage_access_ready(),public.journey_storage_open(text,text),public.questionnaire_stage(uuid,text) from public;
grant execute on function public.stage_client_unlocked(uuid),public.client_stage_access(),public.stage_access_ready(),public.journey_storage_open(text,text),public.questionnaire_stage(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
