-- ═══════════════════════════════════════════════════════════════════════
-- Life OS – externe Kalender (Google Kalender & Co. per iCal-Abo)
-- Die URL ist eine geheime Adresse: nur der Server liest sie, der Client
-- bekommt eine maskierte Variante. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.calendar_feeds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  url         text not null check (url ~ '^https://'),
  color       text not null default 'amber',
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, url)
);

alter table public.calendar_feeds enable row level security;
drop policy if exists "own rows" on public.calendar_feeds;
create policy "own rows" on public.calendar_feeds for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
