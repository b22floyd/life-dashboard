alter table public.journal_entries
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Backfill rows created before auth existed. Safe for a single-user
-- dashboard: assigns any orphaned rows to the one existing account. Run
-- this migration after creating your Supabase user (see README).
update public.journal_entries
set user_id = (select id from auth.users limit 1)
where user_id is null;

alter table public.journal_entries
  alter column user_id set not null,
  alter column user_id set default auth.uid();

drop policy if exists "Allow read access to journal_entries" on public.journal_entries;
drop policy if exists "Allow insert access to journal_entries" on public.journal_entries;

create policy "Users can view their own journal entries"
  on public.journal_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert their own journal entries"
  on public.journal_entries for insert
  with check (auth.uid() = user_id);
