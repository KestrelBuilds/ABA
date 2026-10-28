begin;
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
commit;
