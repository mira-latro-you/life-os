export type EventKind = "event" | "todo";

export interface LifeEvent {
  id: string;
  user_id: string;
  kind: EventKind;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  done: boolean;
  remind_at: string | null;
  source: "manual" | "ai";
  created_at: string;
  updated_at: string;
}

export interface NewsItem {
  id: string;
  title: string;
  topline: string | null;
  url: string;
  date: string;
}

/* ── Future Log ─────────────────────────────── */

export type FutureCategory = "aufgabe" | "idee" | "projekt";
export type FutureStatus = "open" | "scheduled" | "done" | "archived";

export interface FutureItem {
  id: string;
  title: string;
  notes: string | null;
  category: FutureCategory;
  horizon: string | null;
  status: FutureStatus;
  scheduled_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleSuggestion {
  id: string;
  future_item_id: string;
  kind: EventKind;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  reason: string;
  status: "pending" | "accepted" | "dismissed";
  created_at: string;
}

/** Vorschlag inkl. Titel des zugehörigen Items (für die Anzeige). */
export interface SuggestionWithItem extends ScheduleSuggestion {
  future_items: Pick<FutureItem, "id" | "title" | "category"> | null;
}

/* ── Einstellungen ──────────────────────────── */

export interface UserSettings {
  user_id: string;
  show_school: boolean;
  last_future_scan: string | null;
}

/* ── Widgets ────────────────────────────────── */

export type WidgetType = "ppl" | "project" | "sport";

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  config: Record<string, unknown>;
  pinned: boolean;
  position: number;
  created_at: string;
}

export interface WidgetEntry {
  id: string;
  widget_id: string;
  data: Record<string, unknown>;
  occurred_at: string;
  done: boolean;
  created_at: string;
}

export interface WidgetWithEntries extends Widget {
  entries: WidgetEntry[];
}

/* ── School Hub / Timeline ──────────────────── */

export interface SchoolLesson {
  id: string;
  datum: string; // YYYY-MM-DD
  start: string; // HH:MM
  ende: string; // HH:MM
  fach: string;
  fachName: string | null;
  raum: string;
  lehrer: string;
  status: string; // "Regulär" | "Entfall" | "Änderung" | …
  info: string;
  hausaufgaben: string;
  pruefung: string;
}

export interface SchoolExam {
  titel: string;
  datum: string;
  start: string;
  fach: string;
}

export interface SchoolSnapshot {
  lessons: SchoolLesson[];
  exams: SchoolExam[];
  fetchedAt: string;
}

export type SchoolState =
  | { state: "off" }
  | { state: "not_configured" }
  | { state: "ok"; snapshot: SchoolSnapshot; stale: boolean }
  | { state: "error"; message: string };

export type TimelineItem =
  | {
      type: "event";
      id: string;
      start: string; // ISO
      end: string | null;
      title: string;
      location: string | null;
      allDay: boolean;
    }
  | {
      type: "lesson";
      id: string;
      start: string; // ISO
      end: string;
      title: string;
      subtitle: string;
      cancelled: boolean;
      changed: boolean;
      note: string;
    };
