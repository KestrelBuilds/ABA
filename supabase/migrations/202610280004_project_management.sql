begin;
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

commit;
