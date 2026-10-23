"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useActions } from "@/lib/store/provider";
import { TASK_TYPE_LABEL } from "@/components/ui/tokens";
import type { TaskType } from "@/lib/types";

/** Schnell-Eingabe für einen Bereich: Titel + Typ, Enter speichert. */
export function QuickAdd({ workspaceId, types, project }: { workspaceId: string; types: TaskType[]; project?: string }) {
  const actions = useActions();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>(types[0]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const t = title;
    setTitle("");
    await actions.addTask({ title: t, type, workspace_id: workspaceId, project: project ?? null });
  }

  return (
    <form onSubmit={submit} className="glass-strong rounded-2xl p-2">
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Neue ${TASK_TYPE_LABEL[type].one}…`}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[16px] placeholder:text-ink-faint focus:outline-none"
        />
        <button type="submit" disabled={!title.trim()} aria-label="Hinzufügen" className="grid size-9 place-items-center rounded-xl bg-glow-400/90 text-abyss-950 disabled:bg-white/10 disabled:text-ink-faint">
          <Plus className="size-4" />
        </button>
      </div>
      <div className="no-scrollbar mt-1 flex gap-1 overflow-x-auto px-1">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs transition-all ${type === t ? "bg-white/[0.12] text-ink" : "text-ink-muted"}`}
          >
            {TASK_TYPE_LABEL[t].one}
          </button>
        ))}
      </div>
    </form>
  );
}
