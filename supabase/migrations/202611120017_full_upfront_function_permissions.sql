begin;

-- New functions receive default Supabase grants; explicitly remove anon access.
revoke all on function public.apply_upfront_payment_to_final_invoice()
  from public,anon,authenticated;
revoke all on function public.verify_full_upfront_payment(uuid,date,boolean,text,uuid)
  from public,anon;
grant execute on function public.verify_full_upfront_payment(uuid,date,boolean,text,uuid)
  to authenticated;

commit;
