-- Permit authenticated contract uploads and returns to use ordinary Word
-- documents alongside the existing PDF/image file types.
begin;
update storage.buckets
set allowed_mime_types = case
  when allowed_mime_types is null then null
  else array(
    select distinct unnest(
      allowed_mime_types || array[
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    )
  )
end
where id in ('project-files', 'client-assets');
commit;
