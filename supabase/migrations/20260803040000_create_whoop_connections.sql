create table public.whoop_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whoop_connections enable row level security;

-- Only ever read/written by server-side code (Route Handlers, Server
-- Actions) using the request-scoped Supabase client — never from the browser.
create policy "Users can view their own Whoop connection"
  on public.whoop_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert their own Whoop connection"
  on public.whoop_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own Whoop connection"
  on public.whoop_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own Whoop connection"
  on public.whoop_connections for delete
  using (auth.uid() = user_id);
