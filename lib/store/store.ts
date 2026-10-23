import { createStore } from "zustand/vanilla";
import { createClient } from "@/lib/supabase/client";
import type {
  CalEvent,
  Habit,
  HabitLog,
  Note,
  NoteImage,
  Profile,
  SchoolState,
  ShoppingItem,
  Snapshot,
  Suggestion,
  Task,
  UserSettings,
  Workspace,
} from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════
   Globaler Store (Zustand)
   - wird aus einem Server-Snapshot hydratisiert → erste Ansicht ohne Ladezeit
   - alle Mutationen sind optimistisch: UI ändert sich sofort, Supabase im Hintergrund,
     bei Fehler Rollback + Toast
   - Supabase Realtime spielt Änderungen anderer Geräte über applyChange() ein
   Neue Module ergänzen hier eine Collection + Aktionen (siehe COLLECTIONS).
   ═══════════════════════════════════════════════════════════════════ */

/** Supabase-Tabelle → Store-Collection. Steuert Realtime und generisches Upsert/Delete. */
export const COLLECTIONS = {
  tasks: "tasks",
  events: "events",
  notes: "notes",
  note_images: "noteImages",
  shopping_items: "shopping",
  habits: "habits",
  habit_logs: "habitLogs",
  schedule_suggestions: "suggestions",
  workspaces: "workspaces",
} as const;

export type TableName = keyof typeof COLLECTIONS;
type CollectionKey = (typeof COLLECTIONS)[TableName];
type Row = { id: string } & Record<string, unknown>;

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error" | "success";
  action?: { label: string; run: () => void };
}

export interface LifeState {
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
  school: SchoolState;
  toasts: Toast[];
  brainOpen: boolean;
  editor: EditorState;
}

/** Globaler Editor (ein Sheet für Aufgaben/Termine, von überall aufrufbar). */
export type EditorState =
  | null
  | { type: "task"; id?: string; draft?: Partial<Task> }
  | { type: "event"; id?: string; draft?: Partial<CalEvent> };

export interface LifeActions {
  hydrate: (s: Snapshot) => void;
  applyChange: (table: TableName, type: "INSERT" | "UPDATE" | "DELETE", row: Row) => void;
  upsertLocal: (table: TableName, rows: Row[]) => void;
  removeLocal: (table: TableName, ids: string[]) => void;
  toast: (message: string, tone?: Toast["tone"], action?: Toast["action"]) => void;
  dismissToast: (id: number) => void;
  setBrainOpen: (open: boolean) => void;
  setSchool: (s: SchoolState) => void;
  openEditor: (e: EditorState) => void;

  // Generische CRUD-Helfer mit Optimistik
  insert: <T extends { id: string }>(table: TableName, row: T) => Promise<boolean>;
  update: <T extends { id: string }>(table: TableName, id: string, patch: Partial<T>) => Promise<boolean>;
  remove: (table: TableName, id: string) => Promise<boolean>;

  // Domänen-Aktionen
  addTask: (input: Partial<Task> & { title: string }) => Promise<Task | null>;
  toggleTask: (id: string) => Promise<void>;
  scheduleTask: (id: string, start: string | null, end: string | null) => Promise<void>;
  acceptSuggestion: (id: string) => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;
  addEvent: (input: Partial<CalEvent> & { title: string; starts_at: string }) => Promise<CalEvent | null>;
  addShopping: (title: string, extra?: Partial<ShoppingItem>) => Promise<void>;
  toggleShopping: (id: string) => Promise<void>;
  clearDoneShopping: () => Promise<void>;
  addNote: (input: Partial<Note>) => Promise<Note | null>;
  logHabit: (habitId: string, day: string, value?: Record<string, unknown>) => Promise<void>;
  unlogHabit: (habitId: string, day: string) => Promise<void>;
  setProfile: (patch: Partial<Profile>) => Promise<void>;
  setSettings: (patch: Partial<UserSettings>) => Promise<void>;
}

export type LifeStore = LifeState & LifeActions;

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
let toastSeq = 0;

function snapshotToState(s: Snapshot): Omit<LifeState, "school" | "toasts" | "brainOpen" | "editor"> {
  return {
    userId: s.userId,
    loadedAt: s.loadedAt,
    profile: s.profile,
    settings: s.settings,
    workspaces: s.workspaces,
    tasks: s.tasks,
    events: s.events,
    notes: s.notes,
    noteImages: s.noteImages,
    shopping: s.shopping,
    habits: s.habits,
    habitLogs: s.habitLogs,
    suggestions: s.suggestions,
  };
}

function upsertInto<T extends { id: string }>(list: T[], rows: T[]): T[] {
  if (rows.length === 0) return list;
  const map = new Map(list.map((x) => [x.id, x]));
  for (const r of rows) map.set(r.id, { ...(map.get(r.id) ?? {}), ...r } as T);
  return [...map.values()];
}

export function createLifeStore(snapshot: Snapshot) {
  const db = () => createClient();

  return createStore<LifeStore>()((set, get) => {
    const col = (table: TableName) => COLLECTIONS[table] as CollectionKey;
    const read = <T>(table: TableName) => get()[col(table)] as unknown as T[];
    const write = (table: TableName, rows: unknown[]) => set({ [col(table)]: rows } as Partial<LifeState>);

    const fail = (message: string, error?: unknown) => {
      console.error("[store]", message, error);
      get().toast(message, "error");
      return false;
    };

    return {
      ...snapshotToState(snapshot),
      school: snapshot.settings.show_school ? { state: "loading" } : { state: "off" },
      toasts: [],
      brainOpen: false,
      editor: null,

      hydrate: (s) => set(snapshotToState(s)),
      openEditor: (e) => set({ editor: e }),

      applyChange: (table, type, row) => {
        if (type === "DELETE") get().removeLocal(table, [row.id]);
        else get().upsertLocal(table, [row]);
      },

      upsertLocal: (table, rows) => write(table, upsertInto(read<Row>(table), rows)),
      removeLocal: (table, ids) => {
        const drop = new Set(ids);
        write(table, read<Row>(table).filter((r) => !drop.has(r.id)));
      },

      toast: (message, tone = "info", action) => {
        const id = ++toastSeq;
        set({ toasts: [...get().toasts, { id, message, tone, action }] });
        setTimeout(() => get().dismissToast(id), action ? 6000 : 3500);
      },
      dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
      setBrainOpen: (open) => set({ brainOpen: open }),
      setSchool: (s) => set({ school: s }),

      /* ── generisches CRUD ───────────────────────────────────────── */

      insert: async (table, row) => {
        get().upsertLocal(table, [row as unknown as Row]);
        const { error } = await db().from(table).insert(row);
        if (error) {
          get().removeLocal(table, [row.id]);
          return fail("Speichern fehlgeschlagen", error);
        }
        return true;
      },

      update: async (table, id, patch) => {
        const before = read<Row>(table).find((r) => r.id === id);
        if (!before) return false;
        get().upsertLocal(table, [{ ...before, ...(patch as Record<string, unknown>), id } as Row]);
        const { error } = await db().from(table).update(patch).eq("id", id);
        if (error) {
          get().upsertLocal(table, [before]);
          return fail("Änderung fehlgeschlagen", error);
        }
        return true;
      },

      remove: async (table, id) => {
        const before = read<Row>(table).find((r) => r.id === id);
        get().removeLocal(table, [id]);
        const { error } = await db().from(table).delete().eq("id", id);
        if (error) {
          if (before) get().upsertLocal(table, [before]);
          return fail("Löschen fehlgeschlagen", error);
        }
        return true;
      },

      /* ── Tasks ──────────────────────────────────────────────────── */

      addTask: async (input) => {
        const task: Task = {
          id: uuid(),
          workspace_id: null,
          notes: null,
          type: "task",
          status: "open",
          priority: 0,
          project: null,
          due_at: null,
          scheduled_start: null,
          scheduled_end: null,
          estimate_min: null,
          horizon: null,
          source: "manual",
          completed_at: null,
          created_at: now(),
          updated_at: now(),
          ...input,
          title: input.title.trim().slice(0, 300),
        };
        return (await get().insert("tasks", task)) ? task : null;
      },

      toggleTask: async (id) => {
        const t = get().tasks.find((x) => x.id === id);
        if (!t) return;
        const done = t.status !== "done";
        await get().update<Task>("tasks", id, { status: done ? "done" : "open", completed_at: done ? now() : null });
      },

      scheduleTask: async (id, start, end) => {
        await get().update<Task>("tasks", id, { scheduled_start: start, scheduled_end: end });
        // offene KI-Vorschläge für diese Aufgabe sind damit erledigt
        const pending = get().suggestions.filter((s) => s.task_id === id && s.status === "pending");
        for (const s of pending) await get().update<Suggestion>("schedule_suggestions", s.id, { status: "dismissed" });
      },

      acceptSuggestion: async (id) => {
        const s = get().suggestions.find((x) => x.id === id);
        if (!s?.task_id) return;
        if (s.all_day) await get().update<Task>("tasks", s.task_id, { due_at: s.starts_at });
        else await get().update<Task>("tasks", s.task_id, { scheduled_start: s.starts_at, scheduled_end: s.ends_at });
        await get().update<Suggestion>("schedule_suggestions", id, { status: "accepted" });
        get().removeLocal("schedule_suggestions", [id]);
        get().toast("Eingeplant", "success");
      },

      dismissSuggestion: async (id) => {
        await get().update<Suggestion>("schedule_suggestions", id, { status: "dismissed" });
        get().removeLocal("schedule_suggestions", [id]);
      },

      /* ── Events ─────────────────────────────────────────────────── */

      addEvent: async (input) => {
        const ev: CalEvent = {
          id: uuid(),
          workspace_id: null,
          kind: "event",
          description: null,
          location: null,
          ends_at: null,
          all_day: false,
          remind_at: null,
          source: "manual",
          created_at: now(),
          updated_at: now(),
          ...input,
          title: input.title.trim().slice(0, 200),
        };
        return (await get().insert("events", ev)) ? ev : null;
      },

      /* ── Einkauf ────────────────────────────────────────────────── */

      addShopping: async (title, extra = {}) => {
        const t = title.trim();
        if (!t) return;
        const item: ShoppingItem = {
          id: uuid(),
          title: t.slice(0, 200),
          quantity: null,
          store: null,
          project: null,
          done: false,
          done_at: null,
          created_at: now(),
          ...extra,
        };
        await get().insert("shopping_items", item);
      },

      toggleShopping: async (id) => {
        const it = get().shopping.find((x) => x.id === id);
        if (!it) return;
        await get().update<ShoppingItem>("shopping_items", id, { done: !it.done, done_at: it.done ? null : now() });
      },

      clearDoneShopping: async () => {
        const done = get().shopping.filter((s) => s.done);
        if (done.length === 0) return;
        get().removeLocal("shopping_items", done.map((d) => d.id));
        const { error } = await db().from("shopping_items").delete().in("id", done.map((d) => d.id));
        if (error) {
          get().upsertLocal("shopping_items", done as unknown as Row[]);
          fail("Aufräumen fehlgeschlagen", error);
        }
      },

      /* ── Notizen ────────────────────────────────────────────────── */

      addNote: async (input) => {
        const note: Note = {
          id: uuid(),
          workspace_id: null,
          title: null,
          content: "",
          pinned: false,
          tags: [],
          created_at: now(),
          updated_at: now(),
          ...input,
        };
        return (await get().insert("notes", note)) ? note : null;
      },

      /* ── Habits ─────────────────────────────────────────────────── */

      logHabit: async (habitId, day, value = {}) => {
        const existing = get().habitLogs.find((l) => l.habit_id === habitId && l.log_date === day);
        if (existing) return;
        const log: HabitLog = { id: uuid(), habit_id: habitId, log_date: day, value, created_at: now() };
        await get().insert("habit_logs", log);
      },

      unlogHabit: async (habitId, day) => {
        const existing = get().habitLogs.find((l) => l.habit_id === habitId && l.log_date === day);
        if (existing) await get().remove("habit_logs", existing.id);
      },

      /* ── Profil & Einstellungen ─────────────────────────────────── */

      setProfile: async (patch) => {
        const before = get().profile;
        set({ profile: { ...before, ...patch } });
        const { error } = await db().from("profiles").upsert({ ...before, ...patch, user_id: get().userId });
        if (error) {
          set({ profile: before });
          fail("Profil konnte nicht gespeichert werden", error);
        }
      },

      setSettings: async (patch) => {
        const before = get().settings;
        set({ settings: { ...before, ...patch } });
        const { error } = await db().from("user_settings").upsert({ ...before, ...patch, user_id: get().userId });
        if (error) {
          set({ settings: before });
          fail("Einstellung konnte nicht gespeichert werden", error);
        }
      },
    };
  });
}

export type LifeStoreApi = ReturnType<typeof createLifeStore>;
