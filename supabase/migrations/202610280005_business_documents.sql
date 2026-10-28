begin;
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
commit;
