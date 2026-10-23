-- Life OS – initiales Schema
-- Im Supabase Dashboard unter SQL Editor ausführen (oder `supabase db push`).

-- ─────────────────────────────────────────────
-- Termine & To-dos (eine Tabelle, unterschieden über kind)
-- ─────────────────────────────────────────────
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null default 'event' check (kind in ('event', 'todo')),
  title       text not null check (char_length(title) between 1 and 200),
  description text,
  location    text,
  starts_at   timestamptz,            -- bei To-dos = Fälligkeit (optional)
  ends_at     timestamptz,
  all_day     boolean not null default false,
  done        boolean not null default false,
  remind_at   timestamptz,            -- für Push-Reminder (Schritt 3)
  reminded    boolean not null default false,
  source      text not null default 'manual' check (source in ('manual', 'ai')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint event_needs_start check (kind = 'todo' or starts_at is not null),
  constraint end_after_start check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists events_user_start_idx on public.events (user_id, starts_at);
create index if not exists events_reminder_idx  on public.events (remind_at) where reminded = false;

-- ─────────────────────────────────────────────
-- Notizen + Bilder
-- ─────────────────────────────────────────────
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text,
  content     text not null default '',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.note_images (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id      uuid not null references public.notes (id) on delete cascade,
  storage_path text not null,          -- <user_id>/<note_id>/<datei>
  width        int,
  height       int,
  created_at   timestamptz not null default now()
);

create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);

-- ─────────────────────────────────────────────
-- Web-Push-Abos (Schritt 3)
-- ─────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- updated_at automatisch pflegen
-- ─────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────
-- Row Level Security: nur eigene Zeilen
-- ─────────────────────────────────────────────
alter table public.events             enable row level security;
alter table public.notes              enable row level security;
alter table public.note_images        enable row level security;
alter table public.push_subscriptions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['events', 'notes', 'note_images', 'push_subscriptions'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────
-- Storage: privater Bucket für Notiz-Bilder
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-images', 'note-images', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "own note images" on storage.objects;
create policy "own note images" on storage.objects for all to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
