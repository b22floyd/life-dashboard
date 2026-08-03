-- NOT VALID means existing rows (including today's null/uncategorized ones)
-- are left as-is — only new inserts and future updates are required to set
-- a non-null category. Run `validate constraint` later if you ever want to
-- backfill and enforce this on old rows too.
alter table public.workout_sessions
  add constraint workout_sessions_category_not_null
  check (category is not null) not valid;
