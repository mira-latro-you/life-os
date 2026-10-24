# Life OS

Private Single-User-App: dein digitales Gehirn für Berufsschule (1SY1), Arbeit (Intersport · E-Commerce), Stückle & Projekte und Training.
**Stack:** Next.js 16 (App Router) · Tailwind CSS v4 · Zustand · Supabase (Auth, Postgres, Storage, Realtime) · Gemini · Vercel · PWA

## Features

| Modul | Route | Was es kann |
|---|---|---|
| **Brain Dump** | überall (Mitte der Navigation) + Homescreen | Text oder Sprache rein → Gemini zerlegt in Einzelteile und routet in Termine, Aufgaben (Arbeit/Schule/Privat, Typ Frage/Ziel/Idee/Klausur), Einkaufsliste oder Notizen. Jeder Eintrag einzeln rückgängig machbar. |
| **Heute** | `/` | Daily AI Briefing (Tag, Training, Arbeitsfokus, 3 positive Wirtschafts-News, Zitat), Timeline, Fokus-Aufgaben, Habits, News mit Filtern |
| **Kalender** | `/kalender` | Heute / 7 Tage / Monat. Aggregiert Termine, eingeplante & fällige Aufgaben, WebUntis-Stunden + Klausuren aus dem School Hub, KI-Vorschläge. Aufgaben per Drag & Drop aus dem Backlog auf einen Tag ziehen → freier Slot wird gesucht. |
| **Bereiche** | `/bereiche/[key]` | Backlog + Notizen (mit Bildern) pro Lebensbereich. Arbeit: Ziele/Fragen/Ideen. Schule: Klausuren + Untis-Prüfungen. Privat: nach Projekten gruppiert (Stückle, Auto, Coding). KI-Planung schlägt Termine für offene Aufgaben vor. |
| **Routinen** | `/routinen` | PPL-6er-Split mit Rotation, Streak (1 Rest Day pro 7 Tage erlaubt) und Rest-Day-Hinweis nach 6 Trainingstagen; Wochen-Routinen (Meal-Prep sonntags); tägliche Habits |
| **Einkauf** | `/einkauf` | Einkaufsliste nach Laden gruppiert |
| **Einstellungen** | `/einstellungen` | Profil (Kontext für Gemini), School-Hub-Status, Modulübersicht |

**News:** NewsAPI ist im kostenlosen Plan nur für Entwicklung (localhost) erlaubt und 24 h verzögert – daher RSS (t3n, heise, golem, the-decoder) + Tagesschau-API. Gemini klassifiziert jede Schlagzeile (KI, Tech, E-Commerce, Wirtschaft, Allgemein) und markiert positive Meldungen für den „Good News“-Filter. Cache: 45 min.

## Architektur

```
Server (layout.tsx)          Client
───────────────────          ─────────────────────────────────────────────
requireUser()                StoreProvider ── Zustand-Store (lib/store/store.ts)
loadSnapshot() ──Snapshot──▶   • alle Collections im Speicher → Seitenwechsel ohne Laden
                               • optimistisches CRUD (insert/update/remove) + Rollback
                               • Supabase Realtime → applyChange() hält Geräte synchron
Server Actions                 • School Hub via /api/school (30 min Cache)
  brainDump()  ── Gemini ──▶ Tabellen
  scanBacklog() ─ Gemini ──▶ schedule_suggestions
BriefingCard (Suspense, streamt nach)
```

```
app/
  (app)/layout.tsx            Auth + Snapshot + StoreProvider + AppShell
  (app)/loading.tsx           Sofort-Platzhalter bei Seitenwechseln
  (app)/{kalender,bereiche,routinen,einkauf,einstellungen}/
  actions/brain.ts            Brain Dump (Text/Audio → Gemini → Insert)
  actions/ai.ts               Briefing neu erzeugen, Backlog-Scan
  api/school, api/news        Route Handler mit Cache
components/
  brain/ calendar/ workspaces/ habits/ notes/ shopping/ briefing/ news/ editors/ shell/ ui/
lib/
  store/                      Zustand-Store + Provider + Hooks (useLife, useActions)
  modules.ts                  Modul-Registry (Navigation, Einstellungen)
  gemini.ts                   Routing, Scheduling, Briefing, News-Klassifizierung (JSON-Schema)
  calendar.ts                 buildCalendar(), findFreeSlot()
  habits.ts                   Streak-/PPL-Logik
  school-hub.ts news.ts briefing.ts quotes.ts dates.ts types.ts
supabase/migrations/          0001 Basis · 0002 Future Log/Widgets · 0003 Kernschema v3
```

## Datenbank (Supabase)

Alle Tabellen: `user_id default auth.uid()`, RLS-Policy „own rows“, in der Realtime-Publication.

| Tabelle | Zweck |
|---|---|
| `profiles` | Users-Kontext: Name, Klasse, Arbeitgeber, Rolle, Arbeitsfokus |
| `workspaces` | Lebensbereiche (`arbeit`, `schule`, `privat`, erweiterbar) |
| `events` | Termine (all_day, remind_at, workspace_id, source manual/ai) |
| `tasks` | Backlog: type task/goal/question/idea/exam, status, priority, project, due_at, scheduled_start/end, estimate_min |
| `notes` + `note_images` | Notizen mit Tags, Bereich und Bildern (Storage-Bucket `note-images`) |
| `habits` + `habit_logs` | Routinen (kind ppl/weekly/daily, config jsonb) + ein Log pro Tag; Streaks werden aus Logs berechnet |
| `shopping_items` | Einkaufsliste |
| `schedule_suggestions` | KI-Terminvorschläge für Tasks |
| `briefings` | ein Daily Briefing pro Tag |
| `brain_dumps` | Protokoll aller Brain-Dump-Eingaben |
| `user_settings`, `external_cache` | Einstellungen, Cache für School Hub/News |

Vollständiges SQL: `supabase/migrations/0003_life_os_core.sql`.

## Neues Modul andocken (z. B. Finanzen)

1. **Migration** `supabase/migrations/0004_finanzen.sql`: Tabelle(n) mit `user_id default auth.uid()`, RLS „own rows“, `alter publication supabase_realtime add table …`
2. **Typen** in `lib/types.ts`, **Snapshot** in `lib/data/snapshot.ts` laden
3. **Store**: Tabelle in `COLLECTIONS` (lib/store/store.ts) eintragen → Realtime + generisches `insert/update/remove` funktionieren sofort; Domänen-Aktionen nach Bedarf ergänzen
4. **Seite** `app/(app)/finanzen/page.tsx` + Komponenten in `components/finanzen/`
5. **Registry** `lib/modules.ts`: Eintrag hinzufügen → Navigation und Einstellungen übernehmen ihn
6. optional: Brain-Dump-Route in `lib/gemini.ts` (`route` um `"expense"` erweitern) und Dashboard-Karte

## Setup

1. Supabase-Projekt (Frankfurt) → SQL Editor: Migrationen `0001` → `0002` → `0003` ausführen.
2. Authentication → Users → eigenen Account anlegen, Sign-ups deaktivieren.
3. Env-Variablen (lokal `.env.local`, sonst Vercel):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `SCHOOL_HUB_API_URL`, `SCHOOL_HUB_KEY`
4. `npm install && npm run dev` · Deploy: Push auf `main` → Vercel baut automatisch.

## Auf dem Handy installieren

- **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“.
- **Android (Chrome):** Menü → „App installieren“.
