begin;
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
commit;
