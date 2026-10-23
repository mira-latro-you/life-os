-- ═══════════════════════════════════════════════════════════════════════
-- Life OS v3 – Kernschema
--   profiles · workspaces · tasks · events · notes · shopping_items
--   habits · habit_logs · briefings · brain_dumps
-- Übernimmt bestehende Daten (To-dos, Future Log, PPL-Widget, Projekt- und Sport-Widgets).
-- Idempotent: kann gefahrlos mehrfach ausgeführt werden.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Users: Profil mit Kontext für KI und Briefing ──────────────────────
create table if not exists public.profiles (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name  text,
  school_class  text,
  employer      text,
  job_role      text,
  work_focus    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Workspaces: Lebensbereiche (erweiterbar) ───────────────────────────
create table if not exists public.workspaces (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key          text not null check (key ~ '^[a-z0-9-]{2,30}$'),
  name         text not null,
  description  text,
  icon         text not null default 'folder',
  color        text not null default 'blue',
  position     int  not null default 0,
  created_at   timestamptz not null default now(),
  unique (user_id, key)
);

-- ── Tasks: Backlog aller Bereiche ──────────────────────────────────────
create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace_id     uuid references public.workspaces (id) on delete set null,
  title            text not null check (char_length(title) between 1 and 300),
  notes            text,
  type             text not null default 'task' check (type in ('task', 'goal', 'question', 'idea', 'exam')),
  status           text not null default 'open' check (status in ('open', 'done', 'archived')),
  priority         smallint not null default 0 check (priority between 0 and 2),
  project          text,
  due_at           timestamptz,
  scheduled_start  timestamptz,
  scheduled_end    timestamptz,
  estimate_min     int check (estimate_min between 5 and 720),
  horizon          text,
  source           text not null default 'manual' check (source in ('manual', 'ai', 'brain_dump', 'migration')),
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint tasks_schedule_order check (scheduled_end is null or scheduled_start is null or scheduled_end > scheduled_start)
);
create index if not exists tasks_user_status_idx on public.tasks (user_id, status);
create index if not exists tasks_user_sched_idx  on public.tasks (user_id, scheduled_start);
create index if not exists tasks_workspace_idx   on public.tasks (workspace_id);

-- ── Events: Bereich zuordenbar ─────────────────────────────────────────
alter table public.events add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
create index if not exists events_workspace_idx on public.events (workspace_id);

-- ── Notes: Bereich + Tags ──────────────────────────────────────────────
alter table public.notes add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.notes add column if not exists tags text[] not null default '{}';
create index if not exists notes_workspace_idx on public.notes (workspace_id);

-- ── Einkaufsliste ──────────────────────────────────────────────────────
create table if not exists public.shopping_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  quantity    text,
  store       text,
  project     text,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists shopping_user_idx on public.shopping_items (user_id, done);

-- ── Habits + Logs (Streaks werden aus den Logs berechnet) ──────────────
create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  kind        text not null default 'daily' check (kind in ('ppl', 'weekly', 'daily')),
  config      jsonb not null default '{}'::jsonb,
  color       text not null default 'blue',
  pinned      boolean not null default true,
  position    int not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id    uuid not null references public.habits (id) on delete cascade,
  log_date    date not null,
  value       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, log_date desc);

-- ── Daily AI Briefing (ein Eintrag pro Tag) ────────────────────────────
create table if not exists public.briefings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  briefing_date  date not null,
  content        jsonb not null,
  created_at     timestamptz not null default now(),
  unique (user_id, briefing_date)
);

-- ── Brain-Dump-Protokoll (Nachvollziehbarkeit + Undo) ──────────────────
create table if not exists public.brain_dumps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  input       text not null,
  result      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ── KI-Terminvorschläge zeigen jetzt auf Tasks ─────────────────────────
alter table public.schedule_suggestions add column if not exists task_id uuid references public.tasks (id) on delete cascade;
alter table public.schedule_suggestions alter column future_item_id drop not null;
create unique index if not exists schedule_suggestions_one_pending_task
  on public.schedule_suggestions (task_id) where status = 'pending' and task_id is not null;

-- ── updated_at-Trigger ─────────────────────────────────────────────────
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['profiles', 'workspaces', 'tasks', 'shopping_items', 'habits', 'habit_logs', 'briefings', 'brain_dumps'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- Standarddaten für bestehende Nutzer
-- ═══════════════════════════════════════════════════════════════════════
insert into public.profiles (user_id, display_name, school_class, employer, job_role, work_focus)
select id, 'Justus', '1SY1', 'Intersport', 'E-Commerce', 'Mehr Fragen stellen und Verantwortung übernehmen'
from auth.users
on conflict (user_id) do nothing;

insert into public.workspaces (user_id, key, name, description, icon, color, position)
select u.id, w.key, w.name, w.description, w.icon, w.color, w.position
from auth.users u
cross join (values
  ('arbeit', 'Arbeit',            'Intersport · E-Commerce',   'briefcase',  'blue',    0),
  ('schule', 'Berufsschule',      'Klasse 1SY1',               'graduation', 'violet',  1),
  ('privat', 'Privat & Projekte', 'Stückle, Auto, Coding',     'sprout',     'emerald', 2)
) as w(key, name, description, icon, color, position)
on conflict (user_id, key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════
-- Datenübernahme aus v1/v2
-- ═══════════════════════════════════════════════════════════════════════

-- 1) Alte To-dos aus events → tasks
insert into public.tasks (id, user_id, workspace_id, title, notes, type, status, due_at, source, completed_at, created_at)
select e.id, e.user_id,
       (select w.id from public.workspaces w where w.user_id = e.user_id and w.key = 'privat'),
       e.title, e.description, 'task',
       case when e.done then 'done' else 'open' end,
       e.starts_at, 'migration',
       case when e.done then e.updated_at end,
       e.created_at
from public.events e
where e.kind = 'todo'
on conflict (id) do nothing;
delete from public.events where kind = 'todo';

-- 2) Future Log → tasks (bereits eingeplante Items existieren schon als Termin)
insert into public.tasks (id, user_id, workspace_id, title, notes, type, status, horizon, source, created_at)
select f.id, f.user_id,
       (select w.id from public.workspaces w where w.user_id = f.user_id and w.key = 'privat'),
       f.title, f.notes,
       case f.category when 'idee' then 'idea' when 'projekt' then 'goal' else 'task' end,
       case f.status when 'done' then 'done' when 'archived' then 'archived' else 'open' end,
       f.horizon, 'migration', f.created_at
from public.future_items f
where f.status <> 'scheduled'
on conflict (id) do nothing;

update public.schedule_suggestions s set task_id = s.future_item_id
where s.task_id is null and s.status = 'pending'
  and exists (select 1 from public.tasks t where t.id = s.future_item_id);

-- 3) PPL-Widget → Habit (6er-Split mit Rest-Day)
insert into public.habits (id, user_id, name, kind, config, pinned, position)
select w.id, w.user_id, w.title, 'ppl',
       '{"split": ["push", "pull", "legs", "push", "pull", "legs"]}'::jsonb, w.pinned, w.position
from public.widgets w
where w.type = 'ppl'
on conflict (id) do nothing;

insert into public.habit_logs (user_id, habit_id, log_date, value)
select e.user_id, e.widget_id, (e.occurred_at at time zone 'Europe/Berlin')::date, jsonb_build_object('split', e.data ->> 'split')
from public.widget_entries e
join public.widgets w on w.id = e.widget_id and w.type = 'ppl'
on conflict (habit_id, log_date) do nothing;

-- 4) Projekt-Widgets → tasks im Bereich Privat (Projektname = Widget-Titel)
insert into public.tasks (id, user_id, workspace_id, title, type, status, project, source, completed_at, created_at)
select e.id, e.user_id,
       (select ws.id from public.workspaces ws where ws.user_id = e.user_id and ws.key = 'privat'),
       coalesce(nullif(e.data ->> 'text', ''), 'Schritt'), 'task',
       case when e.done then 'done' else 'open' end,
       w.title, 'migration',
       case when e.done then now() end, e.created_at
from public.widget_entries e
join public.widgets w on w.id = e.widget_id and w.type = 'project'
on conflict (id) do nothing;

-- 5) Sport-Verabredungen ohne Kalendereintrag → events
insert into public.events (id, user_id, kind, title, location, starts_at, ends_at, source)
select e.id, e.user_id, 'event', coalesce(e.data ->> 'title', 'Sport'), e.data ->> 'where',
       e.occurred_at, e.occurred_at + interval '90 minutes', 'manual'
from public.widget_entries e
join public.widgets w on w.id = e.widget_id and w.type = 'sport'
where coalesce(e.data ->> 'event_id', '') = ''
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════════════
-- Realtime: Änderungen live an alle offenen Geräte senden
-- ═══════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['tasks', 'events', 'notes', 'note_images', 'shopping_items', 'habits', 'habit_logs', 'schedule_suggestions', 'workspaces', 'profiles'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
