"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { addProjectTask, deleteEntry, setEntryDone } from "@/app/actions/widgets";
import type { WidgetEntry, WidgetWithEntries } from "@/lib/types";

export function ProjectWidget({ widget }: { widget: WidgetWithEntries }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [, startTransition] = useTransition();
  const tasks = [...widget.entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const [optimistic, update] = useOptimistic(tasks, (state: WidgetEntry[], change: { id: string; done?: boolean; remove?: boolean }) =>
    change.remove ? state.filter((t) => t.id !== change.id) : state.map((t) => (t.id === change.id ? { ...t, done: !!change.done } : t)),
  );

  const done = optimistic.filter((t) => t.done).length;
  const pct = optimistic.length ? Math.round((done / optimistic.length) * 100) : 0;

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    startTransition(async () => {
      await addProjectTask(widget.id, t);
      router.refresh();
    });
  }

  function toggle(id: string, next: boolean) {
    startTransition(async () => {
      update({ id, done: next });
      await setEntryDone(id, next);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      update({ id, remove: true });
      await deleteEntry(id);
      router.refresh();
    });
  }

  // offene zuerst, erledigte unten
  const ordered = [...optimistic.filter((t) => !t.done), ...optimistic.filter((t) => t.done)];

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-400/80 to-glow-400 transition-all duration-700 ease-[var(--ease-fluid)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-ink-muted">
          {done}/{optimistic.length}
        </span>
      </div>

      <ul className="mt-3 flex flex-col">
        {ordered.slice(0, 8).map((t) => (
          <li key={t.id} className="group flex items-center gap-3 py-1.5">
            <button
              onClick={() => toggle(t.id, !t.done)}
              aria-label={t.done ? "Wieder öffnen" : "Erledigt"}
              className={`grid size-[20px] shrink-0 place-items-center rounded-full border transition-all duration-300 active:scale-90 ${
                t.done ? "border-emerald-400/70 bg-emerald-400/80 text-abyss-950" : "border-white/25 text-transparent hover:border-emerald-300/60"
              }`}
            >
              <Check className="size-3" />
            </button>
            <span className={`min-w-0 flex-1 truncate text-sm ${t.done ? "text-ink-faint line-through" : ""}`}>
              {String(t.data.text ?? "")}
            </span>
            <button
              onClick={() => remove(t.id)}
              aria-label="Entfernen"
              className="grid size-6 place-items-center rounded-lg text-ink-faint opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100 max-sm:opacity-60"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {ordered.length > 8 && <li className="py-1 text-xs text-ink-faint">+ {ordered.length - 8} weitere</li>}
      </ul>

      <form onSubmit={add} className="mt-2 flex items-center gap-2 border-t border-white/5 pt-3">
        <Plus className="size-4 shrink-0 text-ink-faint" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Schritt hinzufügen…"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-ink-faint focus:outline-none sm:text-sm"
        />
      </form>
    </div>
  );
}
