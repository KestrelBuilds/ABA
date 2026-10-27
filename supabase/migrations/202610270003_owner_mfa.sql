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
