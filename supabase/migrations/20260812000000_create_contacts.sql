-- Contacts / Relationship Tracker: reach out to people on a per-contact
-- cadence (in days), similar in spirit to Routine Cleaning Reminders but
-- with a custom interval per row instead of a fixed weekly/biweekly/monthly
-- choice. contact_log is an append-only log of "I reached out" events, same
-- shape as cleaning_task_completions.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  category text not null check (category in ('Family', 'Friends', 'Work', 'Extended Family')),
  birthday date,
  important_date date,
  important_date_label text not null default '',
  notes text not null default '',
  gift_ideas text not null default '',
  cadence_days integer not null check (cadence_days > 0),
  created_at timestamptz not null default now()
);

create table public.contact_log (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  contacted_at timestamptz not null default now()
);

create index contact_log_contact_id_contacted_at_idx
  on public.contact_log (contact_id, contacted_at desc);

alter table public.contacts enable row level security;
alter table public.contact_log enable row level security;

create policy "Users can view their own contacts"
  on public.contacts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own contacts"
  on public.contacts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own contacts"
  on public.contacts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own contacts"
  on public.contacts for delete
  using (auth.uid() = user_id);

-- contact_log has no user_id of its own — ownership is checked via a join
-- back to contacts, same pattern as cleaning_task_completions -> cleaning_tasks.
-- The delete policy is included from the start: RLS still applies to rows
-- removed via "on delete cascade", so deleting a contact needs a delete
-- policy on the log table too, not just the parent.
create policy "Users can view their own contact log"
  on public.contact_log for select
  using (
    exists (
      select 1 from public.contacts
      where id = contact_id and user_id = auth.uid()
    )
  );

create policy "Users can insert their own contact log"
  on public.contact_log for insert
  with check (
    exists (
      select 1 from public.contacts
      where id = contact_id and user_id = auth.uid()
    )
  );

create policy "Users can delete their own contact log"
  on public.contact_log for delete
  using (
    exists (
      select 1 from public.contacts
      where id = contact_id and user_id = auth.uid()
    )
  );
