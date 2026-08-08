-- Personal Tasks has no external source (unlike Work Tasks/Todoist) to pull
-- due dates from, so this is a plain nullable column the user sets/edits
-- themselves — a task with no due date is treated as "no date yet", not
-- "due immediately" or an error.
alter table public.personal_tasks
  add column due_date date;
