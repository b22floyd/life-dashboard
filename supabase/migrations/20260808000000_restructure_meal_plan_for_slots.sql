-- Restructures meal_plan_entries from "one row per day, upserted forever"
-- into "one row per (week, day, meal slot)" so a day can have separate
-- Breakfast/Lunch/Dinner plans, each with its own mode (Custom text entry,
-- Eating Out, or Leftovers referencing another slot), and so distinct
-- calendar weeks are stored separately — needed for "Copy previous week"
-- to have an actual previous week to read from.

alter table public.meal_plan_entries
  add column week_start_date date,
  add column meal_slot text,
  add column mode text not null default 'custom',
  add column leftover_day_of_week text,
  add column leftover_meal_slot text;

-- Backfill existing rows (one per day, no slot concept) into the Dinner
-- slot of the current week, in Custom mode — the closest equivalent to
-- their old "day has this one meal planned" meaning. Using the server's
-- current_date here is a one-time backfill detail, not the kind of
-- ongoing "what is today" logic that needs to run client-side.
update public.meal_plan_entries
set
  week_start_date = current_date - extract(dow from current_date)::int,
  meal_slot = 'dinner'
where week_start_date is null;

alter table public.meal_plan_entries
  alter column week_start_date set not null,
  alter column meal_slot set not null;

alter table public.meal_plan_entries
  drop constraint meal_plan_entries_user_id_day_of_week_key;

alter table public.meal_plan_entries
  add constraint meal_plan_entries_meal_slot_check
    check (meal_slot in ('breakfast', 'lunch', 'dinner')),
  add constraint meal_plan_entries_mode_check
    check (mode in ('custom', 'eating_out', 'leftovers')),
  add constraint meal_plan_entries_leftover_day_of_week_check
    check (
      leftover_day_of_week is null
      or leftover_day_of_week in (
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
      )
    ),
  add constraint meal_plan_entries_leftover_meal_slot_check
    check (leftover_meal_slot is null or leftover_meal_slot in ('breakfast', 'lunch', 'dinner')),
  add constraint meal_plan_entries_user_week_day_slot_key
    unique (user_id, week_start_date, day_of_week, meal_slot);
