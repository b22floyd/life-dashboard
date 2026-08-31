-- Three tables were missed when their sibling tables got a user_id index:
-- workout_sessions, personal_tasks, habits, grocery_items/staples, and
-- weight_entries all got one at creation time, but annual_goals,
-- cleaning_tasks, and contacts didn't. Every query against these three
-- filters by user_id (via RLS) and orders by the second column below, so
-- matching that shape lets Postgres satisfy the whole query from the index
-- instead of a full-table scan. No effect on correctness — this is
-- read-performance-only, same as every other index already in this schema.
create index annual_goals_user_id_position_idx
  on public.annual_goals (user_id, position);

create index cleaning_tasks_user_id_created_at_idx
  on public.cleaning_tasks (user_id, created_at asc);

create index contacts_user_id_created_at_idx
  on public.contacts (user_id, created_at asc);
