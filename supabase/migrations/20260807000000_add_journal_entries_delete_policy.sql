-- journal_entries only had select/insert policies until now.
create policy "Users can delete their own journal entries"
  on public.journal_entries for delete
  using (auth.uid() = user_id);
