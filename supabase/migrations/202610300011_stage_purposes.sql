-- Additive display/verification routing only. Never changes access, project
-- confirmations, stage status, file publication or existing invoice safeguards.
begin;
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
commit;
