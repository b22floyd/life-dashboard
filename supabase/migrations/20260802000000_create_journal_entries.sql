create extension if not exists "pgcrypto";

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists journal_entries_entry_date_idx
  on public.journal_entries (entry_date desc, created_at desc);

alter table public.journal_entries enable row level security;

-- Single-user dashboard with no auth yet, so the anon key needs full access.
-- Scope these policies to the authenticated user once auth is added.
create policy "Allow read access to journal_entries"
  on public.journal_entries for select
  using (true);

create policy "Allow insert access to journal_entries"
  on public.journal_entries for insert
  with check (true);
