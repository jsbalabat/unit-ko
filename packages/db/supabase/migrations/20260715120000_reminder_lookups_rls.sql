-- Backfill RLS on the reminder lookup tables. reminder_channels and
-- reminder_statuses were added in 20260702100000_reminder_dispatch_model.sql
-- without the deny-by-default RLS + public read policy every other lookup gets
-- (see 80_rls.sql). Harmless in practice — only the service-role reads them — but
-- it leaves them RLS-disabled, inconsistent with the rest of the schema and
-- flagged by Supabase's linter. Matching desired state now lives in 80_rls.sql.
alter table public.reminder_channels enable row level security;
alter table public.reminder_statuses enable row level security;

create policy reminder_channels_read
  on public.reminder_channels for select to anon, authenticated using (true);
create policy reminder_statuses_read
  on public.reminder_statuses for select to anon, authenticated using (true);
