-- One row per (user_id, action) — a fixed-window request counter for
-- Server Actions that call a paid/quota-limited third-party API
-- (transcribeAudio -> OpenAI Whisper, parseWorkoutText/parseMealIngredients
-- -> Anthropic). Upsert-forever, like weight_goal/meal_plan_entries: the
-- row for a given action just gets its count/window_start overwritten each
-- time its window rolls over, so there's no delete policy here either.
create table public.rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  action text not null,
  window_start timestamptz not null default now(),
  count integer not null default 1,
  primary key (user_id, action)
);

alter table public.rate_limits enable row level security;

create policy "Users can view their own rate limit counters"
  on public.rate_limits for select
  using (auth.uid() = user_id);

create policy "Users can insert their own rate limit counters"
  on public.rate_limits for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own rate limit counters"
  on public.rate_limits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
