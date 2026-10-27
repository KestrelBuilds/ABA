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
