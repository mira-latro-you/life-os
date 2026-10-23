# Life OS

Private Single-User-App: Kalender, To-dos, Notizen, KI-Smart-Input (Gemini) und Tagesbriefing.
**Stack:** Next.js 16 (App Router) · Tailwind CSS v4 · Supabase (Auth, Postgres, Storage) · Vercel · PWA

## Verzeichnisstruktur

```
life-os/
├── app/
│   ├── (app)/                  # geschützter Bereich (Login nötig)
│   │   ├── layout.tsx          # Container + Bottom-Navigation
│   │   ├── page.tsx            # Homescreen: Begrüßung, Smart Input, Briefing, News
│   │   ├── kalender/page.tsx   # Schritt 2
│   │   └── notizen/page.tsx    # Schritt 2
│   ├── api/
│   │   └── smart-input/route.ts  # Text → Gemini → Supabase
│   ├── login/page.tsx
│   ├── layout.tsx              # Root: Font, Hintergrund, Service Worker
│   ├── manifest.ts             # PWA-Manifest
│   └── globals.css             # Design Tokens + glass-Utilities
├── components/
│   ├── home/                   # Greeting, SmartInput, Briefing, TodoCheck, NewsFeed
│   ├── nav/BottomNav.tsx
│   ├── pwa/ServiceWorkerRegister.tsx
│   └── ui/                     # GlassCard, Backdrop
├── lib/
│   ├── supabase/               # client.ts (Browser), server.ts, session.ts (Proxy)
│   ├── gemini.ts               # Prompt, JSON-Schema, Validierung
│   ├── news.ts                 # Tagesschau-API (30 min Cache)
│   ├── dates.ts                # Europe/Berlin-Helfer
│   └── types.ts
├── public/
│   ├── sw.js                   # Service Worker (Push-Handler vorbereitet)
│   └── icons/
├── supabase/
│   ├── migrations/0001_init.sql
│   └── functions/              # Schritt 3: send-reminders (Edge Function)
├── proxy.ts                    # Auth-Schutz für alle Routen (Next 16 = früher middleware.ts)
└── .env.example
```

## Setup

1. **Supabase-Projekt anlegen** (Region Frankfurt `eu-central-1`).
2. **SQL Editor** → Inhalt von `supabase/migrations/0001_init.sql` ausführen.
3. **Authentication → Users → Add user**: deinen Account mit E-Mail + Passwort anlegen („Auto Confirm“).
4. **Authentication → Sign In / Providers → „Allow new users to sign up“ deaktivieren.** Damit kann sich niemand außer dir registrieren.
5. `.env.example` nach `.env.local` kopieren und ausfüllen (Gemini-Key aus Google AI Studio).
6. Lokal starten:
   ```bash
   npm install
   npm run dev
   ```
7. **Deploy:** Repo auf GitHub pushen → in Vercel importieren → dieselben Env-Variablen setzen.

## Auf dem Handy installieren

- **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“. Push-Benachrichtigungen funktionieren auf iOS nur für so installierte Web-Apps.
- **Android (Chrome):** Menü → „App installieren“.

## Features

### Daily Timeline (Homescreen)
Vertikale Zeitachse für heute mit „Jetzt“-Marker, laufenden Terminen und freien Lücken (ab 90 Min).
Der Schalter **Berufsschule** blendet den Stundenplan aus dem **School Hub** ein (Doppelstunden werden
zusammengefasst, Entfall/Änderungen hervorgehoben, Prüfungen erscheinen oben).

School Hub läuft auf Google Apps Script. Life OS ruft serverseitig dessen `/exec`-Schnittstelle
(`fn: "getDashboard"`) auf und speichert nur Stunden + Prüfungen 30 Minuten in `external_cache`.
Benötigte Vercel-Variablen: `SCHOOL_HUB_API_URL`, `SCHOOL_HUB_KEY`.

### Future Log + Auto-Scheduling (`/future`)
Aufgaben, Ideen und Projekte ohne Datum, optional mit grobem Horizont („in 3 Monaten“).
Gemini schlägt passende Kalender-Slots vor – mit Blick auf belegte Termine. Der Scan läuft
automatisch beim Öffnen der App (höchstens alle 12 h) oder per „Neu planen“. Vorschläge lassen sich
einzeln oder gesammelt übernehmen; verworfene Items werden 14 Tage nicht erneut vorgeschlagen.

### Routinen (`/routinen`)
Anpinnbare Widgets: **Push/Pull/Legs**-Tracker, **Projekt**-Checkliste (DIY, Garten …),
**Sport-Verabredungen** (optional direkt im Kalender). Neue Typen: `lib/widgets.ts` + Komponente
in `components/widgets/` + Wert im CHECK-Constraint von `widgets.type`.

### Architektur
- `lib/data/*` – Lesezugriffe (Server), `app/actions/*` – Schreibzugriffe als Server Actions
- `lib/gemini.ts` – gemeinsamer Gemini-Kern (Smart Input + Auto-Scheduling), Output wird immer validiert
- `supabase/migrations/` – nummerierte, idempotente Migrationen, RLS auf allen Tabellen

## Roadmap

- **Schritt 2:** Kalenderansicht (Monat/Woche, Bearbeiten, Löschen) · Notizen mit Bild-Upload
- **Schritt 3:** Web Push (VAPID) via Supabase Edge Function + `pg_cron` (minütlich fällige `remind_at` prüfen, Morgen-Briefing um 7:00)
