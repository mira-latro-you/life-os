-- ═══════════════════════════════════════════════════════════════════════
-- Life OS – App-Termine in den Google Kalender schreiben (über den School Hub)
--   events.google_uid       iCal-UID des Google-Termins (= UID im iCal-Abo → keine Dopplungen)
--   events.google_hash      Prüfsumme der übertragenen Felder (ändert sich etwas → neu übertragen)
--   google_deletions         „Grabsteine“ gelöschter Termine, damit sie auch in Google verschwinden
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════
alter table public.events add column if not exists google_uid text;
alter table public.events add column if not exists google_hash text;
alter table public.events add column if not exists google_sync_started timestamptz;
alter table public.events add column if not exists google_sync_error text;
create index if not exists events_google_pending_idx on public.events (user_id, starts_at) where kind = 'event';

create table if not exists public.google_deletions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  google_uid  text not null,
  created_at  timestamptz not null default now()
);
alter table public.google_deletions enable row level security;
drop policy if exists "own rows" on public.google_deletions;
create policy "own rows" on public.google_deletions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.events_google_tombstone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.google_uid is not null then
    insert into public.google_deletions (user_id, google_uid) values (old.user_id, old.google_uid);
  end if;
  return old;
end;
$$;

drop trigger if exists events_google_tombstone on public.events;
create trigger events_google_tombstone after delete on public.events
  for each row execute function public.events_google_tombstone();
