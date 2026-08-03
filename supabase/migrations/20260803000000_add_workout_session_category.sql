alter table public.workout_sessions
  add column category text check (category in ('Chest', 'Back', 'Shoulder', 'Leg'));
