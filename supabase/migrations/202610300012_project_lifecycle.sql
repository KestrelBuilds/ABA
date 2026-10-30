-- Apply once after 011. No existing project is archived and no historical
-- verification dates or workstream approvals are fabricated.
begin;
alter table public.projects
 add column archived_at timestamptz,
 add column archived_client_access text not null default 'retain' check(archived_client_access in ('retain','suspend')),
 add column separate_approvals boolean not null default false;

create function public.project_client_access_enabled(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.projects p where p.id=target
 and (public.is_admin() or public.owns_client(p.client_id))
 and (p.archived_at is null or p.archived_client_access='retain'));
$$;
create function public.project_client_writable(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_admin() or exists(select 1 from public.projects p where p.id=target
 and public.owns_client(p.client_id) and p.archived_at is null);
$$;
create or replace function public.can_access_project(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_admin() or exists(select 1 from public.projects p where p.id=target
 and public.owns_client(p.client_id) and p.contract_signed and p.deposit_paid
 and (p.archived_at is null or p.archived_client_access='retain'));
$$;
create function public.archive_project(target uuid,archived boolean,client_access text,acknowledged boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 if acknowledged is not true or client_access is null or client_access not in ('retain','suspend') then raise exception 'Choose and acknowledge the client access decision';end if;
 perform 1 from public.projects where id=target for update;
 if not found then raise exception 'Project not found';end if;
 update public.projects set archived_at=case when archived then coalesce(archived_at,now()) else null end,
 archived_client_access=case when archived then client_access else 'retain' end where id=target;
end;$$;

create or replace function public.can_read_prospect_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d join public.projects p on p.id=d.project_id join public.prospect_spaces x on x.project_id=p.id join public.stages s on s.id=d.stage_id and s.project_id=p.id
 where d.id=target and (public.owns_client(p.client_id) and public.project_client_access_enabled(p.id)) and x.enabled and x.enquiry_status<>'closed' and s.visible and d.published and d.category='document' and (
 (x.release_step in ('proposal','agreement') and d.document_role='Proposal' and d.stage_id=x.proposal_stage_id) or
 (x.release_step='agreement' and ((d.document_role='Contract' and d.stage_id=x.contract_stage_id) or (d.document_role='Invoice' and d.stage_id=x.invoice_stage_id)))));
$$;
create or replace function public.can_read_contract_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d where d.id=target and d.document_role='Contract' and public.can_read_prospect_document(d.id)) or exists(
 select 1 from public.documents d join public.contract_exchanges x on x.project_id=d.project_id and x.stage_id=d.stage_id join public.stages s on s.id=x.stage_id and s.project_id=x.project_id join public.projects p on p.id=x.project_id
 where d.id=target and not exists(select 1 from public.prospect_spaces where project_id=p.id) and x.enabled and s.visible and d.published and d.category='document' and d.document_role='Contract' and (public.owns_client(p.client_id) and public.project_client_access_enabled(p.id)));
$$;
create or replace function public.can_read_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d join public.projects p on p.id=d.project_id where d.id=target and
 (public.is_admin() or (public.project_client_access_enabled(p.id) and
 (public.can_read_contract_document(target) or public.can_read_prospect_document(target) or
 (public.can_access_project(p.id) and d.published and (d.category<>'final' or (p.final_paid and p.final_approved))
 and (d.stage_id is null or exists(select 1 from public.stages s where s.id=d.stage_id and s.visible)))))));
$$;
create or replace function public.contract_area(target uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('project_id',p.id,'archived_at',p.archived_at,'name',p.name,'stage_id',s.id,'stage_name',s.name,'contract_signed',p.contract_signed,'deposit_paid',p.deposit_paid,
 'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'version_label',d.version_label) order by d.created_at),'[]'::jsonb) from public.documents d where d.project_id=p.id and d.stage_id=s.id and d.published and d.category='document' and d.document_role='Contract'),
 'returns',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'contract_document_id',a.contract_document_id,'created_at',a.created_at) order by a.created_at),'[]'::jsonb) from public.client_assets a join public.documents d on d.id=a.contract_document_id where a.project_id=p.id and a.stage_id=s.id and d.project_id=p.id and d.stage_id=s.id and d.published and d.category='document' and d.document_role='Contract' and (public.is_admin() or a.uploader_id=auth.uid()))
 ) order by p.created_at),'[]'::jsonb) from public.contract_exchanges x join public.projects p on p.id=x.project_id join public.stages s on s.id=x.stage_id and s.project_id=p.id
 where public.project_client_access_enabled(p.id) and x.enabled and s.visible and not exists(select 1 from public.prospect_spaces where project_id=p.id) and (target is null or p.id=target) and (public.owns_client(p.client_id) or (public.is_admin() and target is not null));
$$;
create or replace function public.prospect_area(target uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('project_id',p.id,'archived_at',p.archived_at,'name',p.name,'enabled',x.enabled,'release_step',x.release_step,'enquiry_status',x.enquiry_status,'booking_url',x.booking_url,'contract_signed',p.contract_signed,'deposit_paid',p.deposit_paid,
 'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'version_label',d.version_label,'document_role',d.document_role) order by d.created_at),'[]'::jsonb) from public.documents d join public.stages s on s.id=d.stage_id and s.project_id=p.id where d.project_id=p.id and x.enabled and x.enquiry_status<>'closed' and d.published and d.category='document' and s.visible and (
 (x.release_step in ('proposal','agreement') and d.document_role='Proposal' and d.stage_id=x.proposal_stage_id) or (x.release_step='agreement' and ((d.document_role='Contract' and d.stage_id=x.contract_stage_id) or (d.document_role='Invoice' and d.stage_id=x.invoice_stage_id))))),
 'returns',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'contract_document_id',a.contract_document_id,'created_at',a.created_at) order by a.created_at),'[]'::jsonb) from public.client_assets a join public.documents d on d.id=a.contract_document_id join public.stages s on s.id=d.stage_id and s.project_id=p.id where a.project_id=p.id and d.project_id=p.id and x.enabled and x.enquiry_status<>'closed' and x.release_step='agreement' and s.visible and d.published and d.category='document' and d.document_role='Contract' and d.stage_id=x.contract_stage_id and (public.is_admin() or a.uploader_id=auth.uid())),
 'responses',(select coalesce(jsonb_agg(jsonb_build_object('document_id',r.document_id,'decision',r.decision,'message',r.message)),'[]'::jsonb) from public.proposal_responses r where r.project_id=p.id and (public.is_admin() or r.actor_id=auth.uid()))
 ) order by p.created_at),'[]'::jsonb) from public.prospect_spaces x join public.projects p on p.id=x.project_id where public.project_client_access_enabled(p.id) and (target is null or p.id=target) and ((public.owns_client(p.client_id) and x.enabled and x.enquiry_status<>'closed') or (public.is_admin() and target is not null));
$$;
create or replace function public.client_portal_ready(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.projects p join public.clients c on c.id=p.client_id where p.client_id=target and not c.deletion_pending and (p.archived_at is null or p.archived_client_access='retain') and ((p.contract_signed and p.deposit_paid) or exists(select 1 from public.prospect_spaces x where x.project_id=p.id and x.enabled and x.enquiry_status<>'closed') or (not exists(select 1 from public.prospect_spaces where project_id=p.id) and exists(select 1 from public.contract_exchanges x join public.stages s on s.id=x.stage_id and s.project_id=x.project_id join public.documents d on d.stage_id=s.id and d.project_id=x.project_id where x.project_id=p.id and x.enabled and s.visible and d.published and d.category='document' and d.document_role='Contract'))));
$$;
create or replace function public.client_storage_writable(target uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare pending boolean;
begin
 if not public.project_client_writable(target) then return false;end if;
 if not (public.is_admin() or exists(select 1 from public.projects p where p.id=target and public.owns_client(p.client_id))) then return false;end if;
 select c.deletion_pending into pending from public.clients c join public.projects p on p.client_id=c.id where p.id=target for update of c;
 return found and not pending;
end;$$;
create policy lifecycle_storage_delete on storage.objects as restrictive for delete to authenticated using(public.is_admin() or exists(select 1 from public.client_assets a where a.object_path=storage.objects.name and bucket_id='client-assets' and public.project_client_writable(a.project_id)));
create policy lifecycle_insert on public.questionnaires as restrictive for insert to authenticated with check(public.project_client_writable(project_id));
create policy lifecycle_update on public.questionnaires as restrictive for update to authenticated using(public.project_client_writable(project_id)) with check(public.project_client_writable(project_id));
create policy lifecycle_delete on public.questionnaires as restrictive for delete to authenticated using(public.project_client_writable(project_id)) ;
create policy lifecycle_insert on public.client_assets as restrictive for insert to authenticated with check(public.project_client_writable(project_id));
create policy lifecycle_update on public.client_assets as restrictive for update to authenticated using(public.project_client_writable(project_id)) with check(public.project_client_writable(project_id));
create policy lifecycle_delete on public.client_assets as restrictive for delete to authenticated using(public.project_client_writable(project_id)) ;
create policy lifecycle_insert on public.client_actions as restrictive for insert to authenticated with check(public.project_client_writable(project_id));
create policy lifecycle_update on public.client_actions as restrictive for update to authenticated using(public.project_client_writable(project_id)) with check(public.project_client_writable(project_id));
create policy lifecycle_delete on public.client_actions as restrictive for delete to authenticated using(public.project_client_writable(project_id)) ;
create policy lifecycle_insert on public.proposal_responses as restrictive for insert to authenticated with check(public.project_client_writable(project_id));
create policy lifecycle_update on public.proposal_responses as restrictive for update to authenticated using(public.project_client_writable(project_id)) with check(public.project_client_writable(project_id));
create policy lifecycle_delete on public.proposal_responses as restrictive for delete to authenticated using(public.project_client_writable(project_id)) ;
create policy lifecycle_insert on public.feedback as restrictive for insert to authenticated with check(exists(select 1 from public.documents d where d.id=document_id and public.project_client_writable(d.project_id)));
create policy lifecycle_update on public.feedback as restrictive for update to authenticated using(exists(select 1 from public.documents d where d.id=document_id and public.project_client_writable(d.project_id))) with check(exists(select 1 from public.documents d where d.id=document_id and public.project_client_writable(d.project_id)));
create policy lifecycle_delete on public.feedback as restrictive for delete to authenticated using(exists(select 1 from public.documents d where d.id=document_id and public.project_client_writable(d.project_id))) ;

-- Append-only evidence. Existing boolean flags stay unchanged and get no
-- invented actor/date/reference. Deletion retains a minimal detached record.
create table public.project_verifications (
 id uuid primary key default gen_random_uuid(),
 project_id uuid references public.projects(id) on delete set null,
 project_label text not null,
 field text not null check(field in ('contract_signed','deposit_paid','final_paid','final_approved','brand_approved','website_approved')),
 confirmed boolean not null,
 recorded_at timestamptz not null default now(),
 actor_id uuid references auth.users(id) on delete set null,
 reference text not null default '' check(length(reference)<=500),
 occurred_on date,
 document_id uuid references public.documents(id) on delete set null,
 document_label text,
 invoice_id uuid references public.invoices(id) on delete set null,
 source text not null check(source in ('owner_check','project_update','native_invoice','stream_approval'))
);
alter table public.project_verifications enable row level security;
revoke all on public.project_verifications from anon,authenticated;
grant select on public.project_verifications to authenticated;
create policy owner_verification_history on public.project_verifications for select to authenticated using(public.is_admin());
create index on public.project_verifications(project_id,recorded_at desc);

create table public.project_stream_approvals (
 project_id uuid not null references public.projects(id) on delete cascade,
 stream text not null check(stream in ('Brand Identity','Website Design')),
 confirmed boolean not null default false,
 checked_at timestamptz not null default now(),
 checked_by uuid references auth.users(id) on delete set null,
 primary key(project_id,stream)
);
alter table public.project_stream_approvals enable row level security;
revoke all on public.project_stream_approvals from anon,authenticated;
grant select on public.project_stream_approvals to authenticated;
create policy owner_stream_approvals on public.project_stream_approvals for select to authenticated using(public.is_admin());

create function public.record_project_verification() returns trigger language plpgsql security definer set search_path='' as $$
declare k text; invoice uuid; date_value date; linked uuid; label text; ref text; event_source text;
begin
 foreach k in array array['contract_signed','deposit_paid','final_paid','final_approved'] loop
  if (to_jsonb(new)->k) is distinct from (to_jsonb(old)->k) then
   invoice:=null;date_value:=null;linked:=null;label:=null;ref:='';event_source:='project_update';
   if k in ('deposit_paid','final_paid') and (to_jsonb(new)->>k)::boolean then
    select id,paid_on into invoice,date_value from public.invoices
    where project_id=new.id and status='Paid' and kind=case when k='deposit_paid' then 'Deposit' else 'Final' end limit 1;
   end if;
   if invoice is not null then event_source:='native_invoice';
   elsif nullif(current_setting('aba.verification_field',true),'')=k then
    ref:=coalesce(current_setting('aba.verification_reference',true),'');
    date_value:=nullif(current_setting('aba.verification_date',true),'')::date;
    linked:=nullif(current_setting('aba.verification_document',true),'')::uuid;
    select name||' · '||version_label into label from public.documents where id=linked and project_id=new.id;
    event_source:='owner_check';
   end if;
   insert into public.project_verifications(project_id,project_label,field,confirmed,actor_id,reference,occurred_on,document_id,document_label,invoice_id,source)
   values(new.id,new.name,k,(to_jsonb(new)->>k)::boolean,auth.uid(),ref,date_value,linked,label,invoice,event_source);
  end if;
 end loop;
 return new;
end;$$;
create trigger record_project_verifications after update on public.projects for each row execute function public.record_project_verification();

create function public.guard_stream_approval() returns trigger language plpgsql security definer set search_path='' as $$
declare both_approved boolean;
begin
 if TG_OP='UPDATE' and old.separate_approvals and not new.separate_approvals then raise exception 'Separate approvals cannot be disabled';end if;
 if new.separate_approvals then
  if new.type<>'Both' then raise exception 'Separate approvals are for combined projects';end if;
  select count(*)=2 into both_approved from public.project_stream_approvals where project_id=new.id and confirmed;
  if new.final_approved is distinct from both_approved then raise exception 'Use the separate branding and website approval checks';end if;
 end if;
 return new;
end;$$;
create trigger guard_stream_approval before insert or update on public.projects for each row execute function public.guard_stream_approval();

create function public.verify_project_record(target uuid,record_field text,confirmed boolean,reference text default '',occurred_on date default null,linked_document uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare p public.projects;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 if record_field is null or record_field not in ('contract_signed','deposit_paid','final_paid','final_approved') or confirmed is null then raise exception 'Choose a valid verification';end if;
 if length(coalesce(reference,''))>500 or occurred_on>(now() at time zone 'Europe/London')::date then raise exception 'Check the evidence reference and date';end if;
 select * into p from public.projects where id=target for update;
 if not found then raise exception 'Project not found';end if;
 if p.separate_approvals and record_field='final_approved' then raise exception 'Use the separate branding and website approval checks';end if;
 if linked_document is not null and not exists(select 1 from public.documents where id=linked_document and project_id=target) then raise exception 'Choose a document from this project';end if;
 if (to_jsonb(p)->>record_field)::boolean=confirmed then raise exception 'This verification is unchanged; remove it before recording a new check';end if;
 perform set_config('aba.verification_field',record_field,true);
 perform set_config('aba.verification_reference',coalesce(reference,''),true);
 perform set_config('aba.verification_date',coalesce(occurred_on::text,''),true);
 perform set_config('aba.verification_document',coalesce(linked_document::text,''),true);
 execute format('update public.projects set %I=$1 where id=$2',record_field) using confirmed,target;
end;$$;

create function public.enable_stream_approvals(target uuid,acknowledged boolean) returns void language plpgsql security definer set search_path='' as $$
declare p public.projects;
begin
 if not public.is_admin() or acknowledged is not true then raise exception 'Owner acknowledgement required';end if;
 select * into p from public.projects where id=target for update;
 if not found or p.type<>'Both' then raise exception 'Choose a combined project';end if;
 if p.separate_approvals then return;end if;
 update public.projects set separate_approvals=true,final_approved=false where id=target;
end;$$;

create function public.verify_stream_approval(target uuid,workstream text,confirmed boolean,reference text default '',linked_document uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare p public.projects;label text;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 if workstream is null or workstream not in ('Brand Identity','Website Design') or confirmed is null or length(coalesce(reference,''))>500 then raise exception 'Check the approval details';end if;
 select * into p from public.projects where id=target for update;
 if not found or not p.separate_approvals or p.type<>'Both' then raise exception 'Enable separate approvals for this combined project first';end if;
 if linked_document is not null then
  select d.name||' · '||d.version_label into label from public.documents d join public.stages s on s.id=d.stage_id
  where d.id=linked_document and d.project_id=target and s.project_id=target and s.stream=workstream and d.category='presentation';
  if not found then raise exception 'Choose a presentation from the matching workstream';end if;
 end if;
 if coalesce((select a.confirmed from public.project_stream_approvals a where a.project_id=target and a.stream=workstream),false)=confirmed then raise exception 'This approval is unchanged';end if;
 insert into public.project_stream_approvals(project_id,stream,confirmed,checked_by) values(target,workstream,confirmed,auth.uid())
 on conflict(project_id,stream) do update set confirmed=excluded.confirmed,checked_at=now(),checked_by=auth.uid();
 insert into public.project_verifications(project_id,project_label,field,confirmed,actor_id,reference,document_id,document_label,source)
 values(target,p.name,case when workstream='Brand Identity' then 'brand_approved' else 'website_approved' end,confirmed,auth.uid(),coalesce(reference,''),linked_document,label,'stream_approval');
 update public.projects set final_approved=(select count(*)=2 from public.project_stream_approvals where project_id=target and project_stream_approvals.confirmed) where id=target;
end;$$;

-- New combined projects start with separate pending approvals. Existing flags
-- remain untouched until an owner explicitly opts an existing project in.
create or replace function public.create_project(project_name text, target_client uuid, project_type text, due_date date, project_budget numeric, template jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare project_id uuid; stage jsonb; idx integer:=0;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 insert into public.projects(name,client_id,type,due,budget,separate_approvals) values(project_name,target_client,project_type,due_date,project_budget,project_type='Both') returning id into project_id;
 for stage in select * from jsonb_array_elements(template) loop
 insert into public.stages(project_id,name,stream,position,purpose) values(project_id,stage->>'name',stage->>'stream',idx,stage->>'purpose'); idx:=idx+1;
 end loop;
 insert into public.project_notes(project_id) values(project_id);
 return project_id;
end; $$;
create function public.project_lifecycle_ready() returns boolean language sql stable set search_path='' as $$select true$$;
revoke all on function public.project_client_access_enabled(uuid),public.project_client_writable(uuid),public.archive_project(uuid,boolean,text,boolean),public.record_project_verification(),public.guard_stream_approval(),public.verify_project_record(uuid,text,boolean,text,date,uuid),public.enable_stream_approvals(uuid,boolean),public.verify_stream_approval(uuid,text,boolean,text,uuid),public.project_lifecycle_ready() from public;
grant execute on function public.project_client_access_enabled(uuid),public.project_client_writable(uuid),public.archive_project(uuid,boolean,text,boolean),public.verify_project_record(uuid,text,boolean,text,date,uuid),public.enable_stream_approvals(uuid,boolean),public.verify_stream_approval(uuid,text,boolean,text,uuid),public.project_lifecycle_ready() to authenticated;
commit;
