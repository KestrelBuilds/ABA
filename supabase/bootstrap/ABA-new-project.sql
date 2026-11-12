-- ABA fresh-project setup, prepared 10 November 2026.
-- ONLY for a NEW, EMPTY Supabase project whose SELECT 1 already succeeds.
-- Combines migrations 001-012 and 014-017. Optional scanner migration 013 is excluded.
-- Does not copy old clients, files, accounts, credentials or test data.
-- Does not create the owner Auth account; follow the separate owner setup instructions.
-- Never run this on the existing ABA project.
begin;
do $fresh_project_guard$ begin
 if to_regclass('public.clients') is not null or to_regclass('public.projects') is not null or to_regclass('public.profiles') is not null then
  raise exception 'STOP: ABA tables already exist. Use this setup only on a NEW EMPTY project; no existing project should be reset.';
 end if;
end; $fresh_project_guard$;


-- BEGIN 202610270001_workspace.sql
-- ABA Studio: apply with the Supabase SQL editor or CLI migrations.
create extension if not exists pgcrypto;
create table public.clients (
 id uuid primary key default gen_random_uuid(), name text not null check (length(name) between 1 and 120),
 contact text not null, email text not null, sector text not null default '', created_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('admin','client')), client_id uuid references public.clients(id),
 check ((role='admin' and client_id is null) or (role='client' and client_id is not null))
);
create table public.projects (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id),
 name text not null check (length(name) between 1 and 120), type text not null check(type in ('Brand Identity','Website Design','Both')),
 due date not null, budget numeric(12,2) not null check(budget>=0), contract_signed boolean not null default false,
 deposit_paid boolean not null default false, final_paid boolean not null default false,
 final_approved boolean not null default false, created_at timestamptz not null default now()
);
create table public.project_notes (project_id uuid primary key references public.projects(id) on delete cascade, body text not null default '');
create table public.stages (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
 name text not null check(length(name) between 1 and 120), stream text not null,
 status text not null default 'Not Started' check(status in ('Not Started','In Progress','Awaiting Client','Awaiting Approval','Completed','On Hold')),
 position integer not null check(position>=0), visible boolean not null default true
);
create table public.questionnaires (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
 kind text not null check(kind in ('brand','website','goodbye')), answers jsonb not null check(jsonb_typeof(answers)='object'),
 submitted_by uuid not null references auth.users(id), submitted_at timestamptz not null default now(), unique(project_id,kind)
);
create table public.documents (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
 name text not null check(length(name) between 1 and 180), object_path text not null unique,
 category text not null check(category in ('presentation','document','final')), published boolean not null default false,
 created_at timestamptz not null default now(), check(object_path=project_id::text||'/'||id::text)
);
create table public.feedback (
 id uuid primary key default gen_random_uuid(), document_id uuid not null references public.documents(id) on delete cascade,
 author_id uuid not null references auth.users(id), body text not null check(length(body) between 1 and 4000),
 decision text not null check(decision in ('comment','changes_requested','approved')), created_at timestamptz not null default now()
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id), entity text not null,
 entity_id uuid not null, action text not null, created_at timestamptz not null default now()
);
create table public.invitations (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id),
 user_id uuid not null unique references auth.users(id) on delete cascade, created_at timestamptz not null default now(), accepted_at timestamptz
);
-- All role and ownership lookups are database-owned and cannot be changed by clients.
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create function public.owns_client(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='client' and client_id=target);
$$;
create function public.can_access_project(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or exists(select 1 from public.projects where id=target and public.owns_client(client_id) and contract_signed and deposit_paid);
$$;
create function public.can_read_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d join public.projects p on p.id=d.project_id where d.id=target and
 (public.is_admin() or (public.can_access_project(p.id) and d.published and (d.category<>'final' or (p.final_paid and p.final_approved)))));
$$;
create function public.accept_invitation() returns void language plpgsql security definer set search_path='' as $$
declare invitation public.invitations;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into invitation from public.invitations where user_id=auth.uid() and accepted_at is null for update;
 if not found then return; end if;
 if not exists(select 1 from public.projects where client_id=invitation.client_id and contract_signed and deposit_paid) then raise exception 'Onboarding requirements are not met'; end if;
 insert into public.profiles(id,role,client_id) values(auth.uid(),'client',invitation.client_id);
 update public.invitations set accepted_at=now() where id=invitation.id;
 insert into public.audit_events(actor_id,entity,entity_id,action) values(auth.uid(),'invitations',invitation.id,'accepted');
end; $$;
-- Atomic project creation avoids half-created workflows and never trusts client stage arrays.
create function public.create_project(project_name text, target_client uuid, project_type text, due_date date, project_budget numeric, template jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare project_id uuid; stage jsonb; idx integer:=0;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 insert into public.projects(name,client_id,type,due,budget) values(project_name,target_client,project_type,due_date,project_budget) returning id into project_id;
 for stage in select * from jsonb_array_elements(template) loop
 insert into public.stages(project_id,name,stream,position) values(project_id,stage->>'name',stage->>'stream',idx); idx:=idx+1;
 end loop;
 insert into public.project_notes(project_id) values(project_id);
 return project_id;
end; $$;
create function public.record_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(actor_id,entity,entity_id,action) values(auth.uid(),TG_TABLE_NAME,case when TG_OP='DELETE' then old.id else new.id end,lower(TG_OP));
 if TG_OP='DELETE' then return old; end if; return new;
end; $$;
-- Prevent any client-side writes from becoming an alternative way to approve a project or alter finances.
alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_notes enable row level security;
alter table public.stages enable row level security;
alter table public.questionnaires enable row level security;
alter table public.documents enable row level security;
alter table public.feedback enable row level security;
alter table public.audit_events enable row level security;
alter table public.invitations enable row level security;
create policy admin_clients on public.clients for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy own_client on public.clients for select to authenticated using(public.owns_client(id));
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
-- Profiles have no user-facing write policy; initial admin is provisioned explicitly in SQL.
create policy admin_projects on public.projects for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy own_projects on public.projects for select to authenticated using(public.can_access_project(id));
create policy admin_notes on public.project_notes for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_stages on public.stages for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy visible_stages on public.stages for select to authenticated using(visible and public.can_access_project(project_id));
create policy admin_questionnaires on public.questionnaires for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy own_questionnaires_read on public.questionnaires for select to authenticated using(public.can_access_project(project_id));
create policy own_questionnaires_insert on public.questionnaires for insert to authenticated with check(
 submitted_by=auth.uid() and public.can_access_project(project_id) and exists(select 1 from public.projects p where p.id=project_id and
 ((kind='brand' and p.type in ('Brand Identity','Both')) or (kind='website' and p.type in ('Website Design','Both')) or (kind='goodbye' and p.final_paid and p.final_approved))));
-- Responses are immutable after submission. Changes can be requested from the admin; no editable audit ambiguity.
create policy admin_documents on public.documents for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy visible_documents on public.documents for select to authenticated using(public.can_read_document(id));
create policy admin_feedback on public.feedback for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy own_feedback_read on public.feedback for select to authenticated using(public.can_read_document(document_id));
create policy own_feedback_insert on public.feedback for insert to authenticated with check(author_id=auth.uid() and public.can_read_document(document_id));
create policy admin_audit on public.audit_events for select to authenticated using(public.is_admin());
create policy admin_invitations on public.invitations for all to authenticated using(public.is_admin()) with check(public.is_admin());
-- Explicit privileges also work without Supabase's default grants.
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.clients, public.projects, public.project_notes, public.stages, public.documents, public.questionnaires, public.feedback, public.invitations to authenticated;
grant select on public.profiles, public.audit_events to authenticated;
revoke all on function public.record_audit() from public;
revoke all on function public.accept_invitation(),public.create_project(text,uuid,text,date,numeric,jsonb),public.is_admin(),public.owns_client(uuid),public.can_access_project(uuid),public.can_read_document(uuid) from public;
grant execute on function public.accept_invitation(),public.create_project(text,uuid,text,date,numeric,jsonb),public.is_admin(),public.owns_client(uuid),public.can_access_project(uuid),public.can_read_document(uuid) to authenticated;
create trigger audit_clients after insert or update or delete on public.clients for each row execute function public.record_audit();
create trigger audit_projects after insert or update or delete on public.projects for each row execute function public.record_audit();
create trigger audit_stages after insert or update or delete on public.stages for each row execute function public.record_audit();
create trigger audit_documents after insert or update or delete on public.documents for each row execute function public.record_audit();
create trigger audit_feedback after insert or update or delete on public.feedback for each row execute function public.record_audit();
create trigger audit_questionnaires after insert or update or delete on public.questionnaires for each row execute function public.record_audit();
create trigger audit_invitations after insert or update or delete on public.invitations for each row execute function public.record_audit();

create function public.revoke_client_access(target uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 delete from public.profiles where role='client' and client_id=target;
 delete from public.invitations where client_id=target;
 insert into public.audit_events(actor_id,entity,entity_id,action) values(auth.uid(),'clients',target,'access_revoked');
end; $$;
revoke all on function public.revoke_client_access(uuid) from public;
grant execute on function public.revoke_client_access(uuid) to authenticated;

create function public.move_stage(target uuid, direction integer) returns void language plpgsql security invoker set search_path='' as $$
declare current_stage public.stages; neighbour public.stages;
begin
 if not public.is_admin() or direction not in (-1,1) then raise exception 'Admin access and valid direction required'; end if;
 select * into current_stage from public.stages where id=target;
 if not found then raise exception 'Milestone not found'; end if;
 -- Serialize reorder operations within a project.
 perform 1 from public.projects where id=current_stage.project_id for update;
 select * into current_stage from public.stages where id=target;
 if direction=-1 then select * into neighbour from public.stages where project_id=current_stage.project_id and position<current_stage.position order by position desc limit 1;
 else select * into neighbour from public.stages where project_id=current_stage.project_id and position>current_stage.position order by position asc limit 1; end if;
 if not found then return; end if;
 update public.stages set position=neighbour.position where id=target;
 update public.stages set position=current_stage.position where id=neighbour.id;
end; $$;
revoke all on function public.move_stage(uuid,integer) from public;
grant execute on function public.move_stage(uuid,integer) to authenticated;

create function public.save_project_controls(target uuid, signed boolean, deposit boolean, final_payment boolean, approved boolean, notes text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 update public.projects set contract_signed=signed,deposit_paid=deposit,final_paid=final_payment,final_approved=approved where id=target;
 if not found then raise exception 'Project not found'; end if;
 insert into public.project_notes(project_id,body) values(target,notes) on conflict(project_id) do update set body=excluded.body;
end; $$;
revoke all on function public.save_project_controls(uuid,boolean,boolean,boolean,boolean,text) from public;
grant execute on function public.save_project_controls(uuid,boolean,boolean,boolean,boolean,text) to authenticated;
create function public.audit_note() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(actor_id,entity,entity_id,action) values(auth.uid(),'project_notes',new.project_id,lower(TG_OP));
 return new;
end; $$;
revoke all on function public.audit_note() from public;
create trigger audit_project_notes after insert or update on public.project_notes for each row execute function public.audit_note();
-- END 202610270001_workspace.sql


-- BEGIN 202610270002_storage.sql
-- Supabase Storage keeps every object private. Object IDs are opaque: project UUID/document UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-files','project-files',false,3145728,array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false, file_size_limit=3145728, allowed_mime_types=excluded.allowed_mime_types;
create policy aba_admin_upload on storage.objects for insert to authenticated with check(bucket_id='project-files' and public.is_admin() and exists(select 1 from public.documents d where d.object_path=storage.objects.name));
create policy aba_private_download on storage.objects for select to authenticated using(bucket_id='project-files' and exists(select 1 from public.documents d where d.object_path=storage.objects.name and public.can_read_document(d.id)));
create policy aba_admin_delete on storage.objects for delete to authenticated using(bucket_id='project-files' and public.is_admin());
-- END 202610270002_storage.sql


-- BEGIN 202610270003_owner_mfa.sql
-- Apply once, after the two existing setup files. No client/project records are changed.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
 and ((auth.jwt()->>'aal')='aal2' or not exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified'));
$$;
-- Accessible for enrollment/challenge before aal2; no application records are exposed.
create function public.owner_mfa_ready() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
revoke all on function public.owner_mfa_ready() from public;
grant execute on function public.owner_mfa_ready() to authenticated;
-- END 202610270003_owner_mfa.sql


-- BEGIN 202610280004_project_management.sql
-- Apply once after 001, 002 and 003. Existing projects/submissions remain intact.
create table public.project_details (
 project_id uuid primary key references public.projects(id) on delete cascade,
 goal text not null default '' check(length(goal)<=6000), deliverables text not null default '' check(length(deliverables)<=6000),
 exclusions text not null default '' check(length(exclusions)<=4000), approver text not null default '' check(length(approver)<=120),
 support text not null default '' check(length(support)<=4000)
);
create table public.project_handover (project_id uuid primary key references public.projects(id) on delete cascade,body text not null default '' check(length(body)<=6000));
create table public.client_actions (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,
 title text not null check(length(title) between 1 and 180), due date, status text not null default 'To do' check(status in ('To do','Done')),
 created_at timestamptz not null default now()
);
create table public.client_assets (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,
 uploader_id uuid not null references auth.users(id),name text not null check(length(name) between 1 and 180),object_path text not null unique,
 created_at timestamptz not null default now(),check(object_path=project_id::text||'/'||id::text)
);
alter table public.documents add column version_label text not null default 'v1' check(length(version_label) between 1 and 40), add column review_due date;
alter table public.feedback add column approver_name text, add column reviewed_version text;
create function public.bind_creative_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select version_label into new.reviewed_version from public.documents where id=new.document_id;
 select c.contact into new.approver_name from public.profiles p join public.clients c on c.id=p.client_id where p.id=auth.uid();
 if new.approver_name is null then new.approver_name:='Studio owner'; end if;
 return new;
end; $$;
revoke all on function public.bind_creative_review() from public;
create trigger bind_review before insert on public.feedback for each row execute function public.bind_creative_review();
create function public.protect_review_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.version_label<>old.version_label or new.object_path<>old.object_path or new.name<>old.name) and exists(select 1 from public.feedback where document_id=old.id) then raise exception 'Upload a new document for a new revision; reviewed files are immutable'; end if;
 return new;
end; $$;
revoke all on function public.protect_review_version() from public;
create trigger protect_document_version before update on public.documents for each row execute function public.protect_review_version();
-- Clients can only toggle the status of their own project's action.
create function public.complete_client_action(target uuid,done boolean) returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.client_actions set status=case when done then 'Done' else 'To do' end where id=target;
 if not found then raise exception 'Action unavailable'; end if;
end; $$;
revoke all on function public.complete_client_action(uuid,boolean) from public;
grant execute on function public.complete_client_action(uuid,boolean) to authenticated;
alter table public.project_details enable row level security;
alter table public.client_actions enable row level security;
alter table public.client_assets enable row level security;
create policy owner_details on public.project_details for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy client_details on public.project_details for select to authenticated using(public.can_access_project(project_id));
create policy owner_actions on public.client_actions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy client_actions_read on public.client_actions for select to authenticated using(public.can_access_project(project_id));
create policy client_actions_update on public.client_actions for update to authenticated using(public.can_access_project(project_id)) with check(public.can_access_project(project_id));
-- Limit client column updates even for direct API calls. Owner title/date changes use a validated definer function.
grant select,insert,delete on public.client_actions to authenticated;
revoke update on public.client_actions from authenticated;
grant update(status) on public.client_actions to authenticated;
create function public.edit_client_action(target uuid,new_title text,new_due date) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Owner access required'; end if;
 update public.client_actions set title=new_title,due=new_due where id=target;
 if not found then raise exception 'Action unavailable'; end if;
end; $$;
revoke all on function public.edit_client_action(uuid,text,date) from public;
grant execute on function public.edit_client_action(uuid,text,date) to authenticated;
create policy assets_read on public.client_assets for select to authenticated using(public.can_access_project(project_id));
create policy assets_insert on public.client_assets for insert to authenticated with check(uploader_id=auth.uid() and public.can_access_project(project_id));
create policy assets_delete on public.client_assets for delete to authenticated using(public.is_admin() or (uploader_id=auth.uid() and public.can_access_project(project_id)));
grant select,insert,update,delete on public.project_details to authenticated;
grant select,insert,delete on public.client_assets to authenticated;
create function public.audit_project_details() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(actor_id,entity,entity_id,action) values(auth.uid(),'project_details',new.project_id,lower(TG_OP));return new;
end; $$;
revoke all on function public.audit_project_details() from public;
create trigger audit_details after insert or update on public.project_details for each row execute function public.audit_project_details();
create trigger audit_client_actions after insert or update or delete on public.client_actions for each row execute function public.record_audit();
create trigger audit_client_assets after insert or delete on public.client_assets for each row execute function public.record_audit();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('client-assets','client-assets',false,3145728,array['application/pdf','image/png','image/jpeg','image/webp']) on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;
create policy client_asset_upload on storage.objects for insert to authenticated with check(bucket_id='client-assets' and exists(select 1 from public.client_assets a where a.object_path=storage.objects.name and a.uploader_id=auth.uid() and public.can_access_project(a.project_id)));
create policy client_asset_read on storage.objects for select to authenticated using(bucket_id='client-assets' and exists(select 1 from public.client_assets a where a.object_path=storage.objects.name and public.can_access_project(a.project_id)));
create policy client_asset_remove on storage.objects for delete to authenticated using(bucket_id='client-assets' and exists(select 1 from public.client_assets a where a.object_path=storage.objects.name and (public.is_admin() or(a.uploader_id=auth.uid() and public.can_access_project(a.project_id)))));
create function public.project_management_ready() returns boolean language sql stable security invoker set search_path='' as $$ select auth.uid() is not null $$;
revoke all on function public.project_management_ready() from public;
grant execute on function public.project_management_ready() to authenticated;

alter table public.project_handover enable row level security;
create policy owner_handover on public.project_handover for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy client_handover on public.project_handover for select to authenticated using(public.can_access_project(project_id) and exists(select 1 from public.projects p where p.id=project_id and p.final_paid and p.final_approved));
grant select,insert,update,delete on public.project_handover to authenticated;
create function public.save_portal_brief(target uuid,new_goal text,new_deliverables text,new_exclusions text,new_approver text,new_support text,new_handover text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Owner access required'; end if;
 insert into public.project_details(project_id,goal,deliverables,exclusions,approver,support) values(target,new_goal,new_deliverables,new_exclusions,new_approver,new_support) on conflict(project_id) do update set goal=excluded.goal,deliverables=excluded.deliverables,exclusions=excluded.exclusions,approver=excluded.approver,support=excluded.support;
 insert into public.project_handover(project_id,body) values(target,new_handover) on conflict(project_id) do update set body=excluded.body;
end; $$;
revoke all on function public.save_portal_brief(uuid,text,text,text,text,text,text) from public;
grant execute on function public.save_portal_brief(uuid,text,text,text,text,text,text) to authenticated;
-- END 202610280004_project_management.sql


-- BEGIN 202610280005_business_documents.sql
-- GBP-only development finance. VAT calculation and live payments are not implemented.
create sequence public.invoice_number_seq;
create table public.finance_settings (
 id boolean primary key default true check(id),seller_name text not null default 'Alex Bell Arts',seller_address text not null default '',seller_email text not null default '',payment_instructions text not null default '',no_vat_confirmed boolean not null default false
);
create table public.client_billing (client_id uuid primary key references public.clients(id),billing_name text not null,billing_address text not null);
create table public.proposal_templates (id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 120),scope text not null,deliverables text not null,timeline text not null,revisions text not null,exclusions text not null,notes text not null default '');
create table public.proposals (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),revision integer not null check(revision>0),status text not null default 'Draft' check(status in ('Draft','Shared','Accepted','Declined')),
 scope text not null default '',deliverables text not null default '',timeline text not null default '',revisions text not null default '',exclusions text not null default '',notes text not null default '',
 total_pence bigint not null check(total_pence>=0 and total_pence<=1000000000),client_snapshot jsonb,seller_snapshot jsonb,shared_at timestamptz,decision_at timestamptz,created_at timestamptz not null default now(),unique(project_id,revision)
);
create table public.invoices (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),kind text not null check(kind in ('Deposit','Final')),number text unique,
 amount_pence bigint not null check(amount_pence>=0 and amount_pence<=1000000000),status text not null default 'Draft' check(status in ('Draft','Issued','Paid','Void')),
 issued_on date,due_on date,paid_on date,client_snapshot jsonb,seller_snapshot jsonb,created_at timestamptz not null default now(),
 check(status='Draft' or number is not null),check(status<>'Paid' or paid_on is not null)
);
alter table public.finance_settings enable row level security;
alter table public.client_billing enable row level security;
alter table public.proposal_templates enable row level security;
alter table public.proposals enable row level security;
alter table public.invoices enable row level security;
create unique index one_live_invoice_kind on public.invoices(project_id,kind) where status<>'Void';
create policy owner_finance_settings on public.finance_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy owner_billing on public.client_billing for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy owner_templates on public.proposal_templates for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy owner_proposals_read on public.proposals for select to authenticated using(public.is_admin());
create policy client_proposals_read on public.proposals for select to authenticated using(status<>'Draft' and public.can_access_project(project_id));
create policy owner_invoices_read on public.invoices for select to authenticated using(public.is_admin());
create policy client_invoices_read on public.invoices for select to authenticated using(status in ('Issued','Paid') and public.can_access_project(project_id));
-- All lifecycle writes are RPC-only; Supabase default table grants are explicitly revoked.
revoke all on public.proposals,public.invoices from anon,authenticated;
grant select on public.proposals,public.invoices to authenticated;
grant select,insert,update,delete on public.finance_settings,public.client_billing,public.proposal_templates to authenticated;
create function public.new_proposal(target uuid,template_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.projects;t public.proposal_templates;new_id uuid;rev integer;
begin
 if not public.is_admin() then raise exception 'Owner access required'; end if;
 select * into p from public.projects where id=target for update;if not found then raise exception 'Project not found';end if;
 select coalesce(max(revision),0)+1 into rev from public.proposals where project_id=target;
 if template_id is not null then select * into t from public.proposal_templates where id=template_id;if not found then raise exception 'Template not found';end if;end if;
 insert into public.proposals(project_id,revision,total_pence,scope,deliverables,timeline,revisions,exclusions,notes) values(target,rev,round(p.budget*100),coalesce(t.scope,''),coalesce(t.deliverables,''),coalesce(t.timeline,''),coalesce(t.revisions,''),coalesce(t.exclusions,''),coalesce(t.notes,'')) returning id into new_id;
 return new_id;
end; $$;
create function public.save_proposal(target uuid,new_scope text,new_deliverables text,new_timeline text,new_revisions text,new_exclusions text,new_notes text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 if length(new_scope)>6000 or length(new_deliverables)>6000 or length(new_timeline)>3000 or length(new_revisions)>2000 or length(new_exclusions)>3000 or length(new_notes)>3000 then raise exception 'Content too long';end if;
 update public.proposals set scope=new_scope,deliverables=new_deliverables,timeline=new_timeline,revisions=new_revisions,exclusions=new_exclusions,notes=new_notes where id=target and status='Draft';
 if not found then raise exception 'Only draft proposals can be edited';end if;
end; $$;
create function public.change_proposal_status(target uuid,new_status text) returns void language plpgsql security definer set search_path='' as $$
declare p public.proposals;c public.clients;f public.finance_settings;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 select * into p from public.proposals where id=target for update;if not found then raise exception 'Proposal not found';end if;
 if new_status='Shared' and p.status='Draft' then
 if trim(p.scope)='' or trim(p.deliverables)='' or trim(p.timeline)='' or trim(p.revisions)='' or trim(p.exclusions)='' then raise exception 'Complete the proposal before sharing';end if;
 select c1.* into c from public.clients c1 join public.projects pr on pr.client_id=c1.id where pr.id=p.project_id;
 select * into f from public.finance_settings where id=true;
 update public.proposals set status='Shared',shared_at=now(),client_snapshot=jsonb_build_object('name',c.name,'contact',c.contact,'email',c.email),seller_snapshot=jsonb_build_object('name',coalesce(f.seller_name,'Alex Bell Arts'),'address',coalesce(f.seller_address,''),'email',coalesce(f.seller_email,'')) where id=target;
 elsif new_status in ('Accepted','Declined') and p.status='Shared' then update public.proposals set status=new_status,decision_at=now() where id=target;
 else raise exception 'Invalid proposal transition';end if;
end; $$;
create function public.create_invoice_pair(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.projects;total bigint;deposit bigint;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 select * into p from public.projects where id=target for update;if not found then raise exception 'Project not found';end if;
 if exists(select 1 from public.invoices where project_id=target and status<>'Void') then raise exception 'Invoice pair already exists';end if;
 if p.deposit_paid or p.final_paid then raise exception 'Existing manual payment records need reconciliation before invoicing';end if;
 total:=round(p.budget*100);
 if exists(select 1 from public.proposals pr where pr.project_id=target and pr.status='Accepted' and pr.revision=(select max(revision) from public.proposals where project_id=target and status='Accepted') and pr.total_pence<>total) then raise exception 'Accepted proposal amount differs from project value; reconcile them before invoicing';end if;
 if total<2 then raise exception 'Project value must be at least two pence';end if;deposit:=(total+1)/2;
 insert into public.invoices(project_id,kind,amount_pence) values(target,'Deposit',deposit),(target,'Final',total-deposit);
end; $$;
create function public.issue_invoice(target uuid,issue_date date,due_date date) returns void language plpgsql security definer set search_path='' as $$
declare i public.invoices;f public.finance_settings;b public.client_billing;cid uuid;issued_number text;sequence_value bigint;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 select * into i from public.invoices where id=target for update;if not found or i.status<>'Draft' then raise exception 'Only draft invoices can be issued';end if;
 if i.kind='Final' and not exists(select 1 from public.projects where id=i.project_id and final_approved) then raise exception 'Verify final creative approval before issuing the final invoice';end if;
 if issue_date is null or due_date is null or due_date<issue_date then raise exception 'Check invoice dates';end if;
 select * into f from public.finance_settings where id=true;
 if not found or trim(f.seller_name)='' or trim(f.seller_address)='' or trim(f.seller_email)='' or not f.no_vat_confirmed then raise exception 'Complete seller details and confirm no VAT is being charged before issuing';end if;
 select client_id into cid from public.projects where id=i.project_id;select * into b from public.client_billing where client_id=cid;
 if not found or trim(b.billing_name)='' or trim(b.billing_address)='' then raise exception 'Complete client billing name and address';end if;
 sequence_value:=nextval('public.invoice_number_seq');issued_number:='ABA-'||to_char(issue_date,'YYYY')||'-'||lpad(sequence_value::text,greatest(6,length(sequence_value::text)),'0');
 update public.invoices set status='Issued',number=issued_number,issued_on=issue_date,due_on=due_date,client_snapshot=jsonb_build_object('name',b.billing_name,'address',b.billing_address),seller_snapshot=jsonb_build_object('name',f.seller_name,'address',f.seller_address,'email',f.seller_email,'payment_instructions',f.payment_instructions,'tax_note','No VAT charged') where id=target;
end; $$;
create function public.record_invoice_payment(target uuid,payment_date date) returns void language plpgsql security definer set search_path='' as $$
declare i public.invoices;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 if payment_date is null or payment_date>(now() at time zone 'Europe/London')::date then raise exception 'Payment date must be today or earlier';end if;
 select * into i from public.invoices where id=target for update;if not found or i.status<>'Issued' then raise exception 'Only issued invoices can be marked fully paid';end if;
 update public.invoices set status='Paid',paid_on=payment_date where id=target;
 update public.projects set deposit_paid=case when i.kind='Deposit' then true else deposit_paid end,final_paid=case when i.kind='Final' then true else final_paid end where id=i.project_id;
end; $$;
create function public.void_invoice(target uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 update public.invoices set status='Void',number=coalesce(number,'VOID-'||id::text) where id=target and status in ('Draft','Issued');if not found then raise exception 'Paid or void invoices cannot be voided';end if;
end; $$;
create function public.replace_void_invoice(target uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare old_invoice public.invoices;new_id uuid;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 select * into old_invoice from public.invoices where id=target;if not found or old_invoice.status<>'Void' then raise exception 'Only void invoices can be replaced';end if;
 perform 1 from public.projects where id=old_invoice.project_id for update;
 if exists(select 1 from public.invoices where project_id=old_invoice.project_id and kind=old_invoice.kind and status<>'Void') then raise exception 'A current invoice already exists for this payment';end if;
 insert into public.invoices(project_id,kind,amount_pence) values(old_invoice.project_id,old_invoice.kind,old_invoice.amount_pence) returning id into new_id;return new_id;
end; $$;
revoke all on function public.replace_void_invoice(uuid) from public;
grant execute on function public.replace_void_invoice(uuid) to authenticated;
create function public.guard_invoice_payment_flags() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.invoices where project_id=new.id and status<>'Void') then
 if new.budget is distinct from old.budget then raise exception 'Void unpaid invoices before changing the project value; paid invoices require separate accounting review';end if;
 if new.deposit_paid is distinct from old.deposit_paid and new.deposit_paid is distinct from exists(select 1 from public.invoices where project_id=new.id and kind='Deposit' and status='Paid') then raise exception 'Update payment status through the invoice record';end if;
 if new.final_paid is distinct from old.final_paid and new.final_paid is distinct from exists(select 1 from public.invoices where project_id=new.id and kind='Final' and status='Paid') then raise exception 'Update payment status through the invoice record';end if;
 end if;return new;
end; $$;
revoke all on function public.guard_invoice_payment_flags() from public;
create trigger protect_invoice_payment_flags before update on public.projects for each row execute function public.guard_invoice_payment_flags();
create trigger audit_proposals after insert or update on public.proposals for each row execute function public.record_audit();
create trigger audit_invoices after insert or update on public.invoices for each row execute function public.record_audit();
create function public.business_documents_ready() returns boolean language sql stable set search_path='' as $$ select auth.uid() is not null $$;
revoke all on function public.new_proposal(uuid,uuid),public.save_proposal(uuid,text,text,text,text,text,text),public.change_proposal_status(uuid,text),public.create_invoice_pair(uuid),public.issue_invoice(uuid,date,date),public.record_invoice_payment(uuid,date),public.void_invoice(uuid),public.business_documents_ready() from public;
grant execute on function public.new_proposal(uuid,uuid),public.save_proposal(uuid,text,text,text,text,text,text),public.change_proposal_status(uuid,text),public.create_invoice_pair(uuid),public.issue_invoice(uuid,date,date),public.record_invoice_payment(uuid,date),public.void_invoice(uuid),public.business_documents_ready() to authenticated;

-- Detailed stage workspaces use the existing secure document/asset services.
create table public.stage_resources(stage_id uuid primary key references public.stages(id) on delete cascade,instructions text not null default '' check(length(instructions)<=6000),booking_url text not null default '' check(length(booking_url)<=500 and (booking_url='' or booking_url ~ '^https://(www\.)?calendly\.com/')));
alter table public.stage_resources enable row level security;
create policy owner_stage_resources on public.stage_resources for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy client_stage_resources on public.stage_resources for select to authenticated using(exists(select 1 from public.stages s where s.id=stage_id and s.visible and public.can_access_project(s.project_id)));
grant select,insert,update,delete on public.stage_resources to authenticated;
alter table public.documents add column stage_id uuid references public.stages(id) on delete restrict,add column document_role text not null default 'General' check(document_role in ('General','Proposal','Contract','Invoice','Presentation','Handover'));
alter table public.client_assets add column stage_id uuid references public.stages(id) on delete restrict;
create function public.validate_stage_attachment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.stage_id is not null and not exists(select 1 from public.stages s where s.id=new.stage_id and s.project_id=new.project_id) then raise exception 'Stage must belong to this project';end if;return new;
end; $$;
revoke all on function public.validate_stage_attachment() from public;
create trigger validate_document_stage before insert or update on public.documents for each row execute function public.validate_stage_attachment();
create trigger validate_asset_stage before insert or update on public.client_assets for each row execute function public.validate_stage_attachment();
create or replace function public.can_read_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d join public.projects p on p.id=d.project_id where d.id=target and
 (public.is_admin() or (public.can_access_project(p.id) and d.published and (d.category<>'final' or (p.final_paid and p.final_approved)) and (d.stage_id is null or exists(select 1 from public.stages s where s.id=d.stage_id and s.visible)))));
$$;
drop policy assets_read on public.client_assets;
drop policy assets_insert on public.client_assets;
create policy assets_read on public.client_assets for select to authenticated using(public.can_access_project(project_id) and (stage_id is null or exists(select 1 from public.stages s where s.id=stage_id and s.visible)));
create policy assets_insert on public.client_assets for insert to authenticated with check(uploader_id=auth.uid() and public.can_access_project(project_id) and (stage_id is null or exists(select 1 from public.stages s where s.id=stage_id and (s.visible or public.is_admin()))));
create function public.audit_stage_resources() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.audit_events(actor_id,entity,entity_id,action) values(auth.uid(),'stage_resources',new.stage_id,lower(TG_OP));return new;end;$$;
revoke all on function public.audit_stage_resources() from public;
create trigger audit_stage_resources after insert or update on public.stage_resources for each row execute function public.audit_stage_resources();
-- END 202610280005_business_documents.sql


-- BEGIN 202610280006_contract_area.sql
-- Explicit owner opt-in, independent of editable stage names. No historic project is opted in.
create table public.contract_exchanges (
 project_id uuid primary key references public.projects(id) on delete cascade,
 stage_id uuid not null references public.stages(id) on delete restrict,
 enabled boolean not null default false
);
alter table public.contract_exchanges enable row level security;
create policy owner_contract_exchanges on public.contract_exchanges for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.contract_exchanges to authenticated;
create trigger validate_contract_stage before insert or update on public.contract_exchanges for each row execute function public.validate_stage_attachment();
create function public.audit_contract_exchange() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.audit_events(actor_id,entity,entity_id,action) values(auth.uid(),'contract_exchanges',new.project_id,lower(TG_OP));return new;end;$$;
revoke all on function public.audit_contract_exchange() from public;
create trigger audit_contract_exchanges after insert or update on public.contract_exchanges for each row execute function public.audit_contract_exchange();
alter table public.client_assets add column contract_document_id uuid references public.documents(id) on delete restrict;

create function public.contract_area_ready() returns boolean language sql stable set search_path='' as $$ select auth.uid() is not null $$;
create function public.can_read_contract_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d join public.contract_exchanges x on x.project_id=d.project_id and x.stage_id=d.stage_id
 join public.stages s on s.id=x.stage_id and s.project_id=x.project_id join public.projects p on p.id=x.project_id
 where d.id=target and x.enabled and s.visible and d.published and d.category='document' and d.document_role='Contract' and public.owns_client(p.client_id));
$$;
create function public.can_return_contract_document(target uuid,project uuid,stage uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.can_read_contract_document(target) and exists(select 1 from public.documents d where d.id=target and d.project_id=project and d.stage_id=stage);
$$;
create function public.can_read_contract_asset(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.client_assets a where a.id=target and a.uploader_id=auth.uid() and public.can_return_contract_document(a.contract_document_id,a.project_id,a.stage_id));
$$;
create or replace function public.can_read_document(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.can_read_contract_document(target) or exists(select 1 from public.documents d join public.projects p on p.id=d.project_id where d.id=target and
 (public.is_admin() or (public.can_access_project(p.id) and d.published and (d.category<>'final' or (p.final_paid and p.final_approved)) and (d.stage_id is null or exists(select 1 from public.stages s where s.id=d.stage_id and s.visible)))));
$$;
-- Broader download permission must not accidentally open creative feedback before onboarding.
drop policy own_feedback_read on public.feedback;
drop policy own_feedback_insert on public.feedback;
create policy own_feedback_read on public.feedback for select to authenticated using(public.can_read_document(document_id) and exists(select 1 from public.documents d where d.id=document_id and public.can_access_project(d.project_id)));
create policy own_feedback_insert on public.feedback for insert to authenticated with check(author_id=auth.uid() and public.can_read_document(document_id) and exists(select 1 from public.documents d where d.id=document_id and public.can_access_project(d.project_id)));

drop policy assets_read on public.client_assets;
drop policy assets_insert on public.client_assets;
drop policy assets_delete on public.client_assets;
create policy assets_read on public.client_assets for select to authenticated using(public.can_read_contract_asset(id) or (public.can_access_project(project_id) and (stage_id is null or exists(select 1 from public.stages s where s.id=stage_id and s.visible))));
create policy assets_insert on public.client_assets for insert to authenticated with check(uploader_id=auth.uid() and ((public.can_access_project(project_id) and (stage_id is null or exists(select 1 from public.stages s where s.id=stage_id and (s.visible or public.is_admin())))) or public.can_return_contract_document(contract_document_id,project_id,stage_id)));
create policy assets_delete on public.client_assets for delete to authenticated using(public.is_admin() or (uploader_id=auth.uid() and (public.can_access_project(project_id) or public.can_read_contract_asset(id))));
-- Prevent a forged return attachment even after full onboarding.
create function public.validate_contract_return() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.contract_document_id is not null and not exists(select 1 from public.documents d where d.id=new.contract_document_id and d.project_id=new.project_id and d.stage_id=new.stage_id and d.document_role='Contract' and d.category='document') then raise exception 'Return must reference this stage contract';end if;return new;
end;$$;
create trigger validate_contract_return before insert or update on public.client_assets for each row execute function public.validate_contract_return();
drop policy client_asset_upload on storage.objects;
drop policy client_asset_read on storage.objects;
drop policy client_asset_remove on storage.objects;
create policy client_asset_upload on storage.objects for insert to authenticated with check(bucket_id='client-assets' and exists(select 1 from public.client_assets a where a.object_path=storage.objects.name and a.uploader_id=auth.uid() and (public.can_access_project(a.project_id) or public.can_read_contract_asset(a.id))));
create policy client_asset_read on storage.objects for select to authenticated using(bucket_id='client-assets' and exists(select 1 from public.client_assets a where a.object_path=storage.objects.name and (public.can_access_project(a.project_id) or public.can_read_contract_asset(a.id))));
create policy client_asset_remove on storage.objects for delete to authenticated using(bucket_id='client-assets' and exists(select 1 from public.client_assets a where a.object_path=storage.objects.name and (public.is_admin() or (a.uploader_id=auth.uid() and (public.can_access_project(a.project_id) or public.can_read_contract_asset(a.id))))));

create function public.client_invitation_ready(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() and exists(select 1 from public.projects p where p.client_id=target and ((p.contract_signed and p.deposit_paid) or exists(
 select 1 from public.contract_exchanges x join public.stages s on s.id=x.stage_id and s.project_id=x.project_id join public.documents d on d.stage_id=s.id and d.project_id=x.project_id
 where x.project_id=p.id and x.enabled and s.visible and d.published and d.category='document' and d.document_role='Contract')));
$$;
create or replace function public.accept_invitation() returns void language plpgsql security definer set search_path='' as $$
declare invitation public.invitations;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into invitation from public.invitations where user_id=auth.uid() and accepted_at is null for update;
 if not found then return;end if;
 if not exists(select 1 from public.projects p where p.client_id=invitation.client_id and ((p.contract_signed and p.deposit_paid) or exists(
 select 1 from public.contract_exchanges x join public.stages s on s.id=x.stage_id and s.project_id=x.project_id join public.documents d on d.stage_id=s.id and d.project_id=x.project_id
 where x.project_id=p.id and x.enabled and s.visible and d.published and d.category='document' and d.document_role='Contract'))) then raise exception 'No available contract area or onboarded project';end if;
 insert into public.profiles(id,role,client_id) values(auth.uid(),'client',invitation.client_id);
 update public.invitations set accepted_at=now() where id=invitation.id;
 insert into public.audit_events(actor_id,entity,entity_id,action) values(auth.uid(),'invitations',invitation.id,'accepted');
end;$$;
-- Minimal contract-only DTO. Full projects/stages/notes/finance policies stay unchanged.
create function public.contract_area(target uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('project_id',p.id,'name',p.name,'stage_id',s.id,'stage_name',s.name,'contract_signed',p.contract_signed,'deposit_paid',p.deposit_paid,
 'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'version_label',d.version_label) order by d.created_at),'[]'::jsonb) from public.documents d where d.project_id=p.id and d.stage_id=s.id and d.published and d.category='document' and d.document_role='Contract'),
 'returns',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'contract_document_id',a.contract_document_id,'created_at',a.created_at) order by a.created_at),'[]'::jsonb) from public.client_assets a join public.documents d on d.id=a.contract_document_id where a.project_id=p.id and a.stage_id=s.id and d.project_id=p.id and d.stage_id=s.id and d.published and d.category='document' and d.document_role='Contract' and (public.is_admin() or a.uploader_id=auth.uid()))
 ) order by p.created_at),'[]'::jsonb)
 from public.contract_exchanges x join public.projects p on p.id=x.project_id join public.stages s on s.id=x.stage_id and s.project_id=p.id
 where x.enabled and s.visible and (target is null or p.id=target) and (public.owns_client(p.client_id) or (public.is_admin() and target is not null));
$$;
revoke all on function public.contract_area_ready(),public.can_read_contract_document(uuid),public.can_return_contract_document(uuid,uuid,uuid),public.can_read_contract_asset(uuid),public.client_invitation_ready(uuid),public.contract_area(uuid),public.validate_contract_return() from public;
grant execute on function public.contract_area_ready(),public.can_read_contract_document(uuid),public.can_return_contract_document(uuid,uuid,uuid),public.can_read_contract_asset(uuid),public.client_invitation_ready(uuid),public.contract_area(uuid) to authenticated;
-- END 202610280006_contract_area.sql


-- BEGIN 202610280007_client_deletion.sql
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
-- END 202610280007_client_deletion.sql


-- BEGIN 202610290008_prospect_spaces.sql
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
-- END 202610290008_prospect_spaces.sql


-- BEGIN 202610290009_enquiries.sql
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
-- END 202610290009_enquiries.sql


-- BEGIN 202610290010_client_invitations.sql
-- Keep account identity and portal permission separate. Existing accepted accounts stay connected.
alter table public.invitations add column if not exists revoked_at timestamptz;
alter table public.invitations add column if not exists expires_at timestamptz;
update public.invitations set expires_at=created_at+interval '7 days' where expires_at is null;
alter table public.invitations alter column expires_at set default (now()+interval '7 days');
alter table public.invitations alter column expires_at set not null;
create or replace function public.client_invitations_ready() returns boolean language sql stable as $$select true$$;
-- Internal helper: exactly the same project eligibility used by the prospective/legacy areas.
create or replace function public.client_portal_ready(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.projects p join public.clients c on c.id=p.client_id where p.client_id=target and not c.deletion_pending and ((p.contract_signed and p.deposit_paid) or exists(select 1 from public.prospect_spaces x where x.project_id=p.id and x.enabled and x.enquiry_status<>'closed') or (not exists(select 1 from public.prospect_spaces where project_id=p.id) and exists(select 1 from public.contract_exchanges x join public.stages s on s.id=x.stage_id and s.project_id=x.project_id join public.documents d on d.stage_id=s.id and d.project_id=x.project_id where x.project_id=p.id and x.enabled and s.visible and d.published and d.category='document' and d.document_role='Contract'))));
$$;
create or replace function public.client_invitation_ready(target uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.is_admin() and public.client_portal_ready(target); $$;
-- No global Auth directory is exposed. Look up only the saved, eligible client's exact email.
create or replace function public.client_invitation_account(target uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare client public.clients; account uuid;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 select * into client from public.clients where id=target for update;
 if not found or client.deletion_pending or not public.client_portal_ready(target) then raise exception 'Enable a shared client area before inviting';end if;
 if (select count(*) from auth.users where lower(btrim(email))=lower(btrim(client.email)))>1 then raise exception 'This email needs account review';end if;
 select id into account from auth.users where lower(btrim(email))=lower(btrim(client.email));
 if account is not null and (exists(select 1 from public.profiles where id=account and (role<>'client' or client_id<>target)) or exists(select 1 from public.invitations where user_id=account and client_id<>target and revoked_at is null)) then raise exception 'This email is already associated with a different account or client';end if;
 return account;
end;$$;
create or replace function public.validate_client_invitation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.client_id<>old.client_id or new.user_id<>old.user_id or (old.revoked_at is not null and new.revoked_at is null) then
  perform 1 from public.clients where id=new.client_id and not deletion_pending for update;
  if not found then raise exception 'Client unavailable';end if;
  perform 1 from auth.users u join public.clients c on c.id=new.client_id where u.id=new.user_id and lower(btrim(u.email))=lower(btrim(c.email)) for update of u;
  if not found then raise exception 'The account must match the saved client email';end if;
  if exists(select 1 from public.profiles where id=new.user_id and (role<>'client' or client_id<>new.client_id)) then raise exception 'Account already connected elsewhere';end if;
 end if;
 return new;
end;$$;
drop trigger if exists validate_client_invitation on public.invitations;
create trigger validate_client_invitation before insert or update on public.invitations for each row execute function public.validate_client_invitation();
create or replace function public.record_client_invitation(target uuid, account uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare expected uuid; invitation_id uuid;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 expected:=public.client_invitation_account(target);
 if expected is null or expected<>account then raise exception 'The account must match the saved client email';end if;
 perform 1 from auth.users where id=account for update;
 -- Recheck bindings after the identity lock; never transfer another live account/invitation.
 if exists(select 1 from public.profiles where id=account) then raise exception 'This account is already connected';end if;
 if exists(select 1 from public.invitations where user_id=account and client_id<>target and revoked_at is null) then raise exception 'Account already invited elsewhere';end if;
 insert into public.invitations(client_id,user_id,created_at,accepted_at,revoked_at,expires_at)values(target,account,now(),null,null,now()+interval '7 days')
 on conflict(user_id) do update set client_id=excluded.client_id,created_at=excluded.created_at,accepted_at=null,revoked_at=null,expires_at=excluded.expires_at returning id into invitation_id;
 return invitation_id;
end;$$;
create or replace function public.accept_invitation() returns void language plpgsql security definer set search_path='' as $$
declare invitation public.invitations; target uuid; account public.profiles;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select client_id into target from public.invitations where user_id=auth.uid();
 if target is null then return;end if;
 -- Same lock order as owner writes/deletion: client, Auth identity, invitation.
 perform 1 from public.clients where id=target and not deletion_pending for update;
 if not found then raise exception 'Client unavailable';end if;
 perform 1 from auth.users where id=auth.uid() for update;
 select * into invitation from public.invitations where user_id=auth.uid() for update;
 if invitation.client_id is distinct from target then raise exception 'Invitation changed. Sign in again';end if;
 select * into account from public.profiles where id=auth.uid();
 if found then
  if account.role<>'client' or account.client_id<>target then raise exception 'Account already connected elsewhere';end if;
  return;
 end if;
 if invitation.revoked_at is not null or invitation.accepted_at is not null or invitation.expires_at<=now() then raise exception 'Ask Alex for a fresh invitation';end if;
 if not public.client_portal_ready(target) then raise exception 'No shared client area is available';end if;
 if not exists(select 1 from auth.users u join public.clients c on c.id=target where u.id=auth.uid() and u.email_confirmed_at is not null and lower(btrim(u.email))=lower(btrim(c.email))) then raise exception 'Client email no longer matches';end if;
 insert into public.profiles(id,role,client_id)values(auth.uid(),'client',target);
 update public.invitations set accepted_at=now() where id=invitation.id;
 insert into public.audit_events(actor_id,entity,entity_id,action)values(auth.uid(),'invitations',invitation.id,'accepted');
end;$$;
create or replace function public.revoke_client_access(target uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 perform 1 from public.clients where id=target and not deletion_pending for update;
 if not found then raise exception 'Client unavailable';end if;
 perform 1 from auth.users where id in(select user_id from public.invitations where client_id=target) order by id for update;
 delete from public.profiles where role='client' and client_id=target;
 update public.invitations set revoked_at=now() where client_id=target and revoked_at is null;
 insert into public.audit_events(actor_id,entity,entity_id,action)values(auth.uid(),'clients',target,'access_revoked');
end;$$;
create or replace function public.client_portal_statuses() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('client_id',c.id,'eligible',public.client_portal_ready(c.id),'state',case
 when exists(select 1 from public.profiles where role='client' and client_id=c.id) then 'connected'
 when i.revoked_at is not null or i.accepted_at is not null then 'revoked'
 when i.expires_at<=now() then 'expired'
 when i.id is not null then 'pending'
 when exists(select 1 from public.audit_events where entity='clients' and entity_id=c.id and action='access_revoked') then 'revoked'
 else 'not_invited' end,'invited_at',i.created_at,'accepted_at',i.accepted_at,'expires_at',i.expires_at)),'[]'::jsonb)
 from public.clients c left join lateral(select * from public.invitations where client_id=c.id order by created_at desc,id desc limit 1)i on true);
end;$$;
revoke all on function public.client_invitations_ready(),public.client_portal_ready(uuid),public.client_invitation_account(uuid),public.validate_client_invitation(),public.record_client_invitation(uuid,uuid),public.client_portal_statuses() from public;
grant execute on function public.client_invitations_ready(),public.client_invitation_account(uuid),public.record_client_invitation(uuid,uuid),public.client_portal_statuses() to authenticated;
-- END 202610290010_client_invitations.sql


-- BEGIN 202610300011_stage_purposes.sql
-- Additive display/verification routing only. Never changes access, project
-- confirmations, stage status, file publication or existing invoice safeguards.

alter table public.stages add column purpose text
 check (purpose in ('progress','contract','deposit','contract_deposit','final_approval','final_payment'));
comment on column public.stages.purpose is 'Stable owner-selected verification purpose; null requires owner choice. Not signature/payment evidence or an access grant.';

-- Map exact legacy labels only when no other stage competes for the same
-- verification in that project/workstream. Combined contract/deposit stages
-- conflict with either separate stage. Custom labels remain unassigned.
with candidates as (
 select id,project_id,stream,
 case
  when stream='Onboarding' and lower(btrim(name))='contract' then 'contract'
  when stream='Onboarding' and lower(btrim(name))='invoice' then 'deposit'
  when stream='Onboarding' and lower(btrim(name))='contract and deposit' then 'contract_deposit'
  when stream in ('Brand Identity','Website Design') and lower(btrim(name)) in ('final review and approval','final approval') then 'final_approval'
  when stream in ('Brand Identity','Website Design') and lower(btrim(name))='final invoice' then 'final_payment'
 end as purpose
 from public.stages
), fields as (
 select *, case purpose
  when 'contract_deposit' then array['contract','deposit']
  else array[purpose] end as checks from candidates where purpose is not null
)
update public.stages s set purpose=c.purpose from fields c
where s.id=c.id and not exists (
 select 1 from fields other where other.id<>c.id
 and other.project_id=c.project_id and other.stream=c.stream
 and other.checks && c.checks
);

-- Preserve the existing atomic creation and RLS/owner checks. Older app
-- versions omit purpose and create unassigned stages, requiring owner choice.
create or replace function public.create_project(project_name text, target_client uuid, project_type text, due_date date, project_budget numeric, template jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare project_id uuid; stage jsonb; idx integer:=0;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 insert into public.projects(name,client_id,type,due,budget) values(project_name,target_client,project_type,due_date,project_budget) returning id into project_id;
 for stage in select * from jsonb_array_elements(template) loop
 insert into public.stages(project_id,name,stream,position,purpose) values(project_id,stage->>'name',stage->>'stream',idx,stage->>'purpose'); idx:=idx+1;
 end loop;
 insert into public.project_notes(project_id) values(project_id);
 return project_id;
end; $$;
create function public.stage_purposes_ready() returns boolean language sql stable security invoker set search_path='' as $$select true$$;
revoke all on function public.stage_purposes_ready() from public;
grant execute on function public.stage_purposes_ready() to authenticated;
-- END 202610300011_stage_purposes.sql


-- BEGIN 202610300012_project_lifecycle.sql
-- Apply once after 011. No existing project is archived and no historical
-- verification dates or workstream approvals are fabricated.

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
-- END 202610300012_project_lifecycle.sql


-- BEGIN 202611070014_stage_journey.sql
-- Apply once after 012. Optional 013 is NOT required and must stay deferred.
-- No stage completion, project verification, publication or client records are fabricated.

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
-- END 202611070014_stage_journey.sql

-- BEGIN 202611120015_word_contract_files.sql
update storage.buckets
set allowed_mime_types = case
  when allowed_mime_types is null then null
  else array(
    select distinct unnest(
      allowed_mime_types || array[
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    )
  )
end
where id in ('project-files', 'client-assets');
-- END 202611120015_word_contract_files.sql

-- BEGIN 202611120016_full_upfront_payment.sql
alter table public.project_verifications
  drop constraint project_verifications_source_check;
alter table public.project_verifications
  add constraint project_verifications_source_check
  check (source in ('owner_check','project_update','native_invoice','stream_approval','full_upfront'));

create unique index one_full_upfront_payment_per_project
  on public.project_verifications(project_id)
  where source='full_upfront' and field='deposit_paid' and confirmed;

create or replace function public.record_project_verification() returns trigger
language plpgsql security definer set search_path='' as $$
declare k text; invoice uuid; date_value date; linked uuid; label text; ref text; event_source text;
begin
 foreach k in array array['contract_signed','deposit_paid','final_paid','final_approved'] loop
  if (to_jsonb(new)->k) is distinct from (to_jsonb(old)->k) then
   if nullif(current_setting('aba.full_upfront_payment',true),'')='true' and k in ('deposit_paid','final_paid') then
    continue;
   end if;
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

create or replace function public.guard_invoice_payment_flags() returns trigger
language plpgsql security definer set search_path='' as $$
declare upfront boolean;
begin
 select exists(
   select 1 from public.project_verifications v
   where v.project_id=new.id and v.source='full_upfront'
     and v.field in ('deposit_paid','final_paid') and v.confirmed
 ) into upfront;
 if upfront and (
   (new.deposit_paid is distinct from old.deposit_paid and not new.deposit_paid) or
   (new.final_paid is distinct from old.final_paid and not new.final_paid)
 ) then raise exception 'A verified full upfront payment cannot be removed from the payment checks';end if;
 if exists(select 1 from public.invoices where project_id=new.id and status<>'Void') then
  if new.budget is distinct from old.budget then raise exception 'Void unpaid invoices before changing the project value; paid invoices require separate accounting review';end if;
  if new.deposit_paid is distinct from old.deposit_paid and new.deposit_paid is distinct from (
    exists(select 1 from public.invoices where project_id=new.id and kind='Deposit' and status='Paid') or upfront
  ) then raise exception 'Update payment status through the invoice record';end if;
  if new.final_paid is distinct from old.final_paid and new.final_paid is distinct from (
    exists(select 1 from public.invoices where project_id=new.id and kind='Final' and status='Paid') or upfront
  ) then raise exception 'Update payment status through the invoice record';end if;
 end if;
 return new;
end;$$;

create function public.apply_upfront_payment_to_final_invoice() returns trigger
language plpgsql security definer set search_path='' as $$
declare payment_date date;
begin
 if old.status='Draft' and new.status='Issued' and new.kind='Final' then
  select v.occurred_on into payment_date
  from public.project_verifications v
  where v.project_id=new.project_id and v.field='final_paid'
    and v.source='full_upfront' and v.confirmed
  order by v.recorded_at desc limit 1;
  if payment_date is not null then
   new.status:='Paid';
   new.paid_on:=payment_date;
  end if;
 end if;
 return new;
end;$$;
revoke all on function public.apply_upfront_payment_to_final_invoice() from public,anon,authenticated;
create trigger apply_upfront_payment_to_final_invoice
before update on public.invoices for each row
execute function public.apply_upfront_payment_to_final_invoice();

create function public.verify_full_upfront_payment(
 target uuid,
 payment_date date,
 acknowledged boolean,
 reference text default '',
 linked_document uuid default null
) returns void language plpgsql security definer set search_path='' as $$
declare p public.projects; deposit_invoice public.invoices; final_invoice public.invoices; label text;
begin
 if not public.is_admin() then raise exception 'Owner access required';end if;
 if acknowledged is not true then raise exception 'Owner confirmation is required';end if;
 if payment_date is null or payment_date>(now() at time zone 'Europe/London')::date then raise exception 'Payment date must be today or earlier';end if;
 if length(coalesce(reference,''))>500 then raise exception 'Payment reference is too long';end if;
 select * into p from public.projects where id=target for update;
 if not found then raise exception 'Project not found';end if;
 if p.deposit_paid or p.final_paid then raise exception 'Use the separate payment checks after either instalment has already been recorded';end if;
 if linked_document is not null then
  select d.name||' · '||d.version_label into label from public.documents d where d.id=linked_document and d.project_id=target;
  if not found then raise exception 'Choose a document from this project';end if;
 end if;
 if exists(select 1 from public.invoices where project_id=target and status<>'Void') then
  select * into deposit_invoice from public.invoices
    where project_id=target and kind='Deposit' and status<>'Void' for update;
  if not found or deposit_invoice.status not in ('Issued','Paid') then raise exception 'Issue the deposit invoice before recording its payment';end if;
  select * into final_invoice from public.invoices
    where project_id=target and kind='Final' and status<>'Void' for update;
  if not found then raise exception 'The generated invoice pair needs reconciliation before recording full upfront payment';end if;
 end if;
 insert into public.project_verifications(project_id,project_label,field,confirmed,actor_id,reference,occurred_on,document_id,document_label,invoice_id,source)
 values(target,p.name,'deposit_paid',true,auth.uid(),coalesce(nullif(trim(reference),''),'Full agreed project amount received upfront (100%)'),payment_date,linked_document,label,case when deposit_invoice.id is not null then deposit_invoice.id else null end,'full_upfront'),
       (target,p.name,'final_paid',true,auth.uid(),coalesce(nullif(trim(reference),''),'Full agreed project amount received upfront (100%)'),payment_date,linked_document,label,case when final_invoice.id is not null and final_invoice.status in ('Issued','Paid') then final_invoice.id else null end,'full_upfront');
 if deposit_invoice.id is not null and deposit_invoice.status='Issued' then
  update public.invoices set status='Paid',paid_on=payment_date where id=deposit_invoice.id;
 end if;
 if final_invoice.id is not null and final_invoice.status='Issued' then
  update public.invoices set status='Paid',paid_on=payment_date where id=final_invoice.id;
 end if;
 perform set_config('aba.full_upfront_payment','true',true);
 update public.projects set deposit_paid=true,final_paid=true where id=target;
end;$$;

revoke all on function public.verify_full_upfront_payment(uuid,date,boolean,text,uuid) from public,anon;
grant execute on function public.verify_full_upfront_payment(uuid,date,boolean,text,uuid) to authenticated;

notify pgrst,'reload schema';
-- END 202611120016_full_upfront_payment.sql

-- BEGIN 202611120017_full_upfront_function_permissions.sql
revoke all on function public.apply_upfront_payment_to_final_invoice()
  from public,anon,authenticated;
revoke all on function public.verify_full_upfront_payment(uuid,date,boolean,text,uuid)
  from public,anon;
grant execute on function public.verify_full_upfront_payment(uuid,date,boolean,text,uuid)
  to authenticated;
-- END 202611120017_full_upfront_function_permissions.sql

commit;
