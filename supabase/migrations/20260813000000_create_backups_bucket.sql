-- Storage bucket for the weekly automated backup JSON files. Private (not
-- public) and touched only by server-side code using the service-role
-- client, which bypasses RLS entirely — so no anon/authenticated storage
-- policies are added here. Storage RLS defaults to deny-all with no
-- policies present, which is exactly the desired behavior: nobody but the
-- service role can read, list, or write into this bucket.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;
