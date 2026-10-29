begin;
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
commit;
