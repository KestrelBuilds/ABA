begin;
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
commit;
