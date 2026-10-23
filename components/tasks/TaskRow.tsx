"use client";

import { CalendarClock, Check, Flag } from "lucide-react";
import { useActions } from "@/lib/store/provider";
import { formatShort } from "@/lib/dates";
import type { Task } from "@/lib/types";

/** Listenzeile für eine Aufgabe – Haken setzen, antippen zum Bearbeiten. */
export function TaskRow({ task, showProject = true }: { task: Task; showProject?: boolean }) {
  const actions = useActions();
  const done = task.status === "done";
  const overdue = !done && task.due_at && new Date(task.due_at).getTime() < Date.now();

  return (
    <li className="group flex items-center gap-3 py-2">
      <button
        onClick={() => actions.toggleTask(task.id)}
        aria-label={done ? "Wieder öffnen" : "Erledigt"}
        className={`grid size-[22px] shrink-0 place-items-center rounded-full border transition-all duration-300 ease-[var(--ease-fluid)] active:scale-90 ${
          done ? "border-emerald-400/80 bg-emerald-400/80 text-abyss-950" : "border-white/25 text-transparent hover:border-glow-400/70 hover:text-glow-300"
        }`}
      >
        <Check className="size-3.5" />
      </button>
      <button onClick={() => actions.openEditor({ type: "task", id: task.id })} className="min-w-0 flex-1 text-left">
        <span className={`block truncate ${done ? "text-ink-faint line-through" : ""}`}>{task.title}</span>
        {(task.scheduled_start || task.due_at || (showProject && task.project)) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
            {task.scheduled_start && (
              <span className="flex items-center gap-1 text-glow-300/90">
                <CalendarClock className="size-3" /> {formatShort(task.scheduled_start)}
              </span>
            )}
            {!task.scheduled_start && task.due_at && (
              <span className={`flex items-center gap-1 ${overdue ? "text-rose-300" : ""}`}>
                <Flag className="size-3" /> {formatShort(task.due_at, true).split(" · ")[0]}
              </span>
            )}
            {showProject && task.project && <span>{task.project}</span>}
          </span>
        )}
      </button>
    </li>
  );
}
