"use client";

import { useMemo, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { field, ghostBtn, primaryBtn, TASK_TYPE_LABEL, tone, WsIcon } from "@/components/ui/tokens";
import { useActions, useLife } from "@/lib/store/provider";
import { berlinLocalToISO, berlinToISO, dayKeyOf, isoToLocalInput } from "@/lib/dates";
import type { Task, TaskType } from "@/lib/types";

const TYPES: TaskType[] = ["task", "question", "goal", "idea", "exam"];
const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

export function TaskEditor({ id, draft, onClose }: { id?: string; draft?: Partial<Task>; onClose: () => void }) {
  const actions = useActions();
  const tasks = useLife((s) => s.tasks);
  const workspaces = useLife((s) => s.workspaces);
  const existing = id ? tasks.find((t) => t.id === id) : undefined;
  const base: Partial<Task> = existing ?? draft ?? {};

  const [title, setTitle] = useState(base.title ?? "");
  const [notes, setNotes] = useState(base.notes ?? "");
  const [type, setType] = useState<TaskType>(base.type ?? "task");
  const [workspaceId, setWorkspaceId] = useState<string | null>(base.workspace_id ?? workspaces[0]?.id ?? null);
  const [project, setProject] = useState(base.project ?? "");
  const [due, setDue] = useState(base.due_at ? dayKeyOf(base.due_at) : "");
  const [start, setStart] = useState(base.scheduled_start ? isoToLocalInput(base.scheduled_start) : "");
  const initialDuration =
    base.scheduled_start && base.scheduled_end
      ? Math.round((new Date(base.scheduled_end).getTime() - new Date(base.scheduled_start).getTime()) / 60_000)
      : base.estimate_min ?? 60;
  const [duration, setDuration] = useState(initialDuration);

  const projects = useMemo(() => [...new Set(tasks.map((t) => t.project).filter(Boolean) as string[])].sort(), [tasks]);

  async function save() {
    if (!title.trim()) return;
    const startIso = start ? berlinLocalToISO(start) : null;
    const patch: Partial<Task> = {
      title: title.trim(),
      notes: notes.trim() || null,
      type,
      workspace_id: workspaceId,
      project: project.trim() || null,
      due_at: due ? berlinToISO(due, "18:00") : null,
      scheduled_start: startIso,
      scheduled_end: startIso ? new Date(new Date(startIso).getTime() + duration * 60_000).toISOString() : null,
      estimate_min: duration,
    };
    if (existing) await actions.update<Task>("tasks", existing.id, patch);
    else await actions.addTask({ ...patch, title: patch.title! });
    onClose();
  }

  async function remove() {
    if (!existing) return;
    onClose();
    const copy = { ...existing };
    if (await actions.remove("tasks", existing.id)) {
      actions.toast("Aufgabe gelöscht", "info", { label: "Rückgängig", run: () => actions.insert("tasks", copy) });
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? "Aufgabe bearbeiten" : "Neue Aufgabe"}
      footer={
        <div className="flex items-center gap-2">
          {existing && (
            <>
              <button onClick={remove} className={`${ghostBtn} hover:text-rose-300`} aria-label="Löschen">
                <Trash2 className="size-4" />
              </button>
              <button
                onClick={async () => {
                  await actions.toggleTask(existing.id);
                  onClose();
                }}
                className={ghostBtn}
              >
                <Check className="size-4" /> {existing.status === "done" ? "Wieder öffnen" : "Erledigt"}
              </button>
            </>
          )}
          <button onClick={save} disabled={!title.trim()} className={`${primaryBtn} ml-auto min-w-28`}>
            Speichern
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <input autoFocus={!existing} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Was ist zu tun?" className={`${field} text-base font-medium`} />

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-all ${type === t ? "bg-white/[0.12] text-ink ring-1 ring-white/15" : "text-ink-muted hover:text-ink"}`}
            >
              {TASK_TYPE_LABEL[t].one}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => setWorkspaceId(w.id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs transition-all ${
                workspaceId === w.id ? `border-white/15 ${tone(w.color).bg} ${tone(w.color).text}` : "border-white/[0.06] text-ink-muted"
              }`}
            >
              <WsIcon name={w.icon} className="size-3.5" />
              <span className="truncate">{w.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>

        <input list="lifeos-projects" value={project} onChange={(e) => setProject(e.target.value)} placeholder="Projekt (optional, z. B. Stückle)" className={field} />
        <datalist id="lifeos-projects">
          {projects.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>

        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notizen" rows={3} className={`${field} resize-none`} />

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Fällig am
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Dauer
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={field}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} Min` : `${d / 60} Std`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Im Kalender einplanen
          <div className="flex gap-2">
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
            {start && (
              <button onClick={() => setStart("")} className={ghostBtn}>
                Entfernen
              </button>
            )}
          </div>
        </label>
      </div>
    </Sheet>
  );
}
