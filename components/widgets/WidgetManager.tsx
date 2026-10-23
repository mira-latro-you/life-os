"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { createWidget, deleteWidget, renameWidget, setWidgetPinned } from "@/app/actions/widgets";
import { Switch } from "@/components/ui/Switch";
import { WidgetIcon } from "./WidgetIcon";
import { WIDGET_TYPES } from "@/lib/widgets";
import type { Widget, WidgetType } from "@/lib/types";

/** Liste der eigenen Widgets (anpinnen, umbenennen, löschen) + Galerie zum Anlegen. */
export function WidgetManager({ widgets }: { widgets: Widget[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState<WidgetType | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [list, apply] = useOptimistic(widgets, (state: Widget[], c: { id: string; pinned?: boolean; remove?: boolean }) =>
    c.remove ? state.filter((w) => w.id !== c.id) : state.map((w) => (w.id === c.id ? { ...w, pinned: !!c.pinned } : w)),
  );

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <>
      {list.length > 0 && (
        <section className="glass animate-rise rounded-3xl p-5 [animation-delay:80ms]">
          <h2 className="mb-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">Deine Widgets</h2>
          <ul className="divide-y divide-white/5">
            {list.map((w) => (
              <li key={w.id} className="flex items-center gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-ink-muted">
                  <WidgetIcon type={w.type} />
                </span>
                {editing === w.id ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setEditing(null);
                      run(() => renameWidget(w.id, name));
                    }}
                  >
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[16px] focus:border-glow-400/50 focus:outline-none sm:text-sm"
                    />
                    <button type="submit" aria-label="Speichern" className="grid size-7 place-items-center rounded-lg text-glow-300 hover:bg-white/5">
                      <Check className="size-4" />
                    </button>
                  </form>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{w.title}</p>
                    <p className="text-xs text-ink-muted">{WIDGET_TYPES[w.type].label}</p>
                  </div>
                )}
                {editing !== w.id && (
                  <button
                    onClick={() => {
                      setEditing(w.id);
                      setName(w.title);
                    }}
                    aria-label="Umbenennen"
                    className="grid size-8 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-white/5 hover:text-ink"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
                <button
                  onClick={() =>
                    startTransition(async () => {
                      if (!confirm(`„${w.title}“ inklusive aller Einträge löschen?`)) return;
                      apply({ id: w.id, remove: true });
                      await deleteWidget(w.id);
                      router.refresh();
                    })
                  }
                  aria-label="Löschen"
                  className="grid size-8 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 className="size-3.5" />
                </button>
                <label className="flex items-center gap-2 pl-1 text-xs text-ink-muted">
                  <span className="hidden min-[400px]:inline">Dashboard</span>
                  <Switch
                    checked={w.pinned}
                    label={`${w.title} auf dem Dashboard anpinnen`}
                    onChange={(next) =>
                      startTransition(async () => {
                        apply({ id: w.id, pinned: next });
                        await setWidgetPinned(w.id, next);
                        router.refresh();
                      })
                    }
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="glass animate-rise rounded-3xl p-5 [animation-delay:160ms]">
        <h2 className="mb-3 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">Neues Widget</h2>
        <div className="grid gap-2">
          {(Object.keys(WIDGET_TYPES) as WidgetType[]).map((t) => (
            <button
              key={t}
              disabled={pending}
              onClick={() => {
                setCreating(t);
                run(async () => {
                  await createWidget(t);
                  setCreating(null);
                });
              }}
              className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-left transition-all duration-300 ease-[var(--ease-fluid)] hover:border-white/15 hover:bg-white/[0.05] active:scale-[0.99] disabled:opacity-60"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-glow-400/12 text-glow-300">
                <WidgetIcon type={t} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{WIDGET_TYPES[t].label}</span>
                <span className="block text-xs leading-relaxed text-ink-muted">{WIDGET_TYPES[t].description}</span>
              </span>
              {creating === t ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-ink-muted" />
              ) : (
                <Plus className="size-4 shrink-0 text-ink-faint transition-colors group-hover:text-ink" />
              )}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
