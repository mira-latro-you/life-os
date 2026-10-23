-- Life OS – Erweiterung: Future Log, Auto-Scheduling, Einstellungen, Widgets, externer Cache
-- Idempotent: kann gefahrlos mehrfach ausgeführt werden.

-- ─────────────────────────────────────────────
-- Future Log: Dinge ohne festes Datum
-- ─────────────────────────────────────────────
create table if not exists public.future_items (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title              text not null check (char_length(title) between 1 and 200),
  notes              text,
  category           text not null default 'aufgabe' check (category in ('aufgabe', 'idee', 'projekt')),
  horizon            text,               -- freier Zeithorizont, z. B. "in 3 Monaten", "im Frühling"
  status             text not null default 'open' check (status in ('open', 'scheduled', 'done', 'archived')),
  scheduled_event_id uuid references public.events (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists future_items_user_status_idx on public.future_items (user_id, status, created_at desc);

-- Vorschläge von Gemini, wann ein Future-Item in den Kalender soll
create table if not exists public.schedule_suggestions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  future_item_id  uuid not null references public.future_items (id) on delete cascade,
  kind            text not null default 'event' check (kind in ('event', 'todo')),
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  all_day         boolean not null default false,
  reason          text not null default '',
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  created_at      timestamptz not null default now()
);

create index if not exists schedule_suggestions_pending_idx
  on public.schedule_suggestions (user_id, status) where status = 'pending';
-- höchstens ein offener Vorschlag pro Item
create unique index if not exists schedule_suggestions_one_pending
  on public.schedule_suggestions (future_item_id) where status = 'pending';

-- ─────────────────────────────────────────────
-- Einstellungen (eine Zeile pro Nutzer)
-- ─────────────────────────────────────────────
create table if not exists public.user_settings (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  show_school       boolean not null default false,
  last_future_scan  timestamptz,
  updated_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- Routine-Widgets
-- ─────────────────────────────────────────────
create table if not exists public.widgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type        text not null check (type in ('ppl', 'project', 'sport')),
  title       text not null check (char_length(title) between 1 and 80),
  config      jsonb not null default '{}'::jsonb,
  pinned      boolean not null default true,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists widgets_user_idx on public.widgets (user_id, pinned, position);

create table if not exists public.widget_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  widget_id   uuid not null references public.widgets (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists widget_entries_widget_idx on public.widget_entries (widget_id, occurred_at desc);

-- ─────────────────────────────────────────────
-- Cache für externe Quellen (z. B. School Hub)
-- ─────────────────────────────────────────────
create table if not exists public.external_cache (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key         text not null,
  payload     jsonb not null,
  fetched_at  timestamptz not null default now(),
  primary key (user_id, key)
);

-- ─────────────────────────────────────────────
-- updated_at-Trigger
-- ─────────────────────────────────────────────
drop trigger if exists future_items_touch on public.future_items;
create trigger future_items_touch before update on public.future_items
  for each row execute function public.touch_updated_at();

drop trigger if exists user_settings_touch on public.user_settings;
create trigger user_settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────
-- Row Level Security: nur eigene Zeilen
-- ─────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['future_items', 'schedule_suggestions', 'user_settings',
                           'widgets', 'widget_entries', 'external_cache'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
