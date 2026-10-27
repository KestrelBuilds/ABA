-- Supabase Storage keeps every object private. Object IDs are opaque: project UUID/document UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-files','project-files',false,3145728,array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false, file_size_limit=3145728, allowed_mime_types=excluded.allowed_mime_types;
create policy aba_admin_upload on storage.objects for insert to authenticated with check(bucket_id='project-files' and public.is_admin() and exists(select 1 from public.documents d where d.object_path=storage.objects.name));
create policy aba_private_download on storage.objects for select to authenticated using(bucket_id='project-files' and exists(select 1 from public.documents d where d.object_path=storage.objects.name and public.can_read_document(d.id)));
create policy aba_admin_delete on storage.objects for delete to authenticated using(bucket_id='project-files' and public.is_admin());
