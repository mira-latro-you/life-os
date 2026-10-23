"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Inbox } from "lucide-react";
import { useActions, useLife } from "@/lib/store/provider";
import { DropZone, TaskChip } from "./dnd";
import { tone } from "@/components/ui/tokens";

/** Backlog-Leiste: offene, ungeplante Aufgaben – per Drag & Drop in den Kalender ziehen. */
export function BacklogTray() {
  const tasks = useLife((s) => s.tasks);
  const workspaces = useLife((s) => s.workspaces);
  const actions = useActions();
  const [filter, setFilter] = useState<string | "all">("all");
  const [open, setOpen] = useState(true);

  const backlog = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "open" && !t.scheduled_start && t.type !== "idea")
        .filter((t) => filter === "all" || t.workspace_id === filter)
        .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") || b.priority - a.priority),
    [tasks, filter],
  );

  return (
    <DropZone id="backlog" className="glass rounded-3xl" activeClassName="ring-1 ring-amber-300/50">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 pb-2 pt-4 text-left">
        <Inbox className="size-4 text-ink-muted" />
        <span className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">Backlog</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] tabular-nums">{backlog.length}</span>
        <span className="ml-auto text-[11px] text-ink-faint">{open ? "gedrückt halten & ziehen" : ""}</span>
        <ChevronDown className={`size-4 text-ink-faint transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="pb-4">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3">
            <button
              onClick={() => setFilter("all")}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${filter === "all" ? "bg-white/[0.12] text-ink" : "text-ink-muted"}`}
            >
              Alle
            </button>
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => setFilter(w.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs ${filter === w.id ? `bg-white/[0.12] ${tone(w.color).text}` : "text-ink-muted"}`}
              >
                <span className={`size-1.5 rounded-full ${tone(w.color).dot}`} />
                {w.name.split(" ")[0]}
              </button>
            ))}
          </div>
          {backlog.length === 0 ? (
            <p className="px-4 text-sm text-ink-muted">Alles eingeplant. Neue Aufgaben kommen über den Brain Dump rein.</p>
          ) : (
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
              {backlog.map((t) => (
                <TaskChip key={t.id} task={t} ws={workspaces.find((w) => w.id === t.workspace_id)} onTap={() => actions.openEditor({ type: "task", id: t.id })} />
              ))}
            </div>
          )}
        </div>
      )}
    </DropZone>
  );
}
