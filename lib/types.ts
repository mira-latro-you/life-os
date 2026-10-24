/* ═══════════════════════════════════════════════════════════════════
   Life OS – Domänen-Typen (spiegeln das Supabase-Schema)
   ═══════════════════════════════════════════════════════════════════ */

export interface Profile {
  user_id: string;
  display_name: string | null;
  school_class: string | null;
  employer: string | null;
  job_role: string | null;
  work_focus: string | null;
}

export interface UserSettings {
  user_id: string;
  show_school: boolean;
  last_future_scan: string | null;
}

export interface Workspace {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  position: number;
}

/* ── Tasks ─────────────────────────────────────────────────────────── */

export type TaskType = "task" | "goal" | "question" | "idea" | "exam";
export type TaskStatus = "open" | "done" | "archived";

export interface Task {
  id: string;
  workspace_id: string | null;
  title: string;
  notes: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: number;
  project: string | null;
  due_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  estimate_min: number | null;
  horizon: string | null;
  source: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Kalender ──────────────────────────────────────────────────────── */

export interface CalEvent {
  id: string;
  workspace_id: string | null;
  kind: "event" | "todo";
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  remind_at: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  /** Verknüpfung mit dem Google Kalender (Life OS → Google) */
  google_uid?: string | null;
  google_hash?: string | null;
  google_sync_error?: string | null;
}

export interface Suggestion {
  id: string;
  task_id: string | null;
  kind: "event" | "todo";
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  reason: string;
  status: "pending" | "accepted" | "dismissed";
  created_at: string;
}

export type CalendarItemKind = "event" | "task" | "lesson" | "suggestion" | "exam";

export interface CalendarItem {
  key: string;
  kind: CalendarItemKind;
  refId: string;
  title: string;
  start: string; // ISO
  end: string | null; // ISO
  allDay: boolean;
  subtitle?: string;
  note?: string;
  workspaceId?: string | null;
  done?: boolean;
  cancelled?: boolean;
  changed?: boolean;
  /** externe Quelle (z. B. Google Kalender) – nur lesen, kein Editor */
  readOnly?: boolean;
  source?: string;
  color?: string;
}

/* ── Notizen & Einkauf ─────────────────────────────────────────────── */

export interface Note {
  id: string;
  workspace_id: string | null;
  title: string | null;
  content: string;
  pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface NoteImage {
  id: string;
  note_id: string;
  storage_path: string;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  title: string;
  quantity: string | null;
  store: string | null;
  project: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string;
}

/* ── Habits ────────────────────────────────────────────────────────── */

export type HabitKind = "ppl" | "weekly" | "daily";

export interface HabitConfig {
  /** PPL: Reihenfolge der Einheiten, danach ist ein Rest Day vorgesehen */
  split?: string[];
  /** weekly/daily: Wochentage (0 = So … 6 = Sa), an denen die Routine fällig ist */
  days?: number[];
}

export interface Habit {
  id: string;
  name: string;
  kind: HabitKind;
  config: HabitConfig;
  color: string;
  pinned: boolean;
  position: number;
  archived: boolean;
  created_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string; // YYYY-MM-DD (Berlin)
  value: Record<string, unknown>;
  created_at: string;
}

/* ── School Hub ────────────────────────────────────────────────────── */

export interface SchoolLesson {
  id: string;
  datum: string;
  start: string;
  ende: string;
  fach: string;
  fachName: string | null;
  raum: string;
  lehrer: string;
  status: string;
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
  | { state: "loading" }
  | { state: "not_configured" }
  | { state: "ok"; snapshot: SchoolSnapshot; stale: boolean }
  | { state: "error"; message: string };

/* ── News & Briefing ───────────────────────────────────────────────── */

export type NewsCategory = "tech" | "ki" | "ecommerce" | "wirtschaft" | "allgemein";

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  published: string;
  category: NewsCategory;
  positive: boolean;
}

export interface BriefingContent {
  greeting: string;
  summary: string;
  schedule: string[];
  training: string;
  workFocus: string;
  news: { title: string; url: string; source: string }[];
  quote: { text: string; author: string };
  generatedAt: string;
  ai: boolean;
}

/* ── Snapshot für die Hydration des Stores ─────────────────────────── */

export interface Snapshot {
  userId: string;
  loadedAt: string;
  profile: Profile;
  settings: UserSettings;
  workspaces: Workspace[];
  tasks: Task[];
  events: CalEvent[];
  notes: Note[];
  noteImages: NoteImage[];
  shopping: ShoppingItem[];
  habits: Habit[];
  habitLogs: HabitLog[];
  suggestions: Suggestion[];
}

/* ── Externe Kalender (Google Kalender per iCal-Abo) ─────────────── */

export interface ExternalEvent {
  id: string;
  feedId: string;
  title: string;
  start: string; // ISO
  end: string | null; // ISO, bei ganztägig exklusiv
  allDay: boolean;
  location: string | null;
}

export interface CalendarFeedStatus {
  id: string;
  name: string;
  color: string;
  /** maskierte Adresse, die geheime URL verlässt den Server nie */
  hint: string;
  ok: boolean;
  error?: string;
  count: number;
}

export type ExternalCalendarState =
  | { state: "loading" }
  | { state: "empty" }
  | { state: "ok"; events: ExternalEvent[]; feeds: CalendarFeedStatus[]; fetchedAt: string; stale: boolean };
