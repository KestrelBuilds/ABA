begin;

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
commit;
