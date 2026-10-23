"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, ShoppingBasket, Sparkles, WandSparkles } from "lucide-react";
import { useActions, useLife } from "@/lib/store/provider";
import { scanBacklog } from "@/app/actions/ai";
import { tone, TASK_TYPE_LABEL, WsIcon } from "@/components/ui/tokens";
import { formatRelative, formatShort } from "@/lib/dates";
import type { TaskType } from "@/lib/types";

/** Übersicht aller Lebensbereiche + KI-Vorschläge für ungeplante Aufgaben. */
export function WorkspaceOverview() {
  const workspaces = useLife((s) => s.workspaces);
  const tasks = useLife((s) => s.tasks);
  const notes = useLife((s) => s.notes);
  const shopping = useLife((s) => s.shopping);
  const suggestions = useLife((s) => s.suggestions);
  const actions = useActions();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const stats = useMemo(
    () =>
      workspaces.map((w) => {
        const open = tasks.filter((t) => t.workspace_id === w.id && t.status === "open");
        const byType = open.reduce<Record<string, number>>((acc, t) => ((acc[t.type] = (acc[t.type] ?? 0) + 1), acc), {});
        return { w, open: open.length, byType, notes: notes.filter((n) => n.workspace_id === w.id).length };
      }),
    [workspaces, tasks, notes],
  );
  const openShopping = shopping.filter((s) => !s.done).length;
  const pendingSugg = suggestions.filter((s) => s.status === "pending" && s.task_id);

  return (
    <div className="flex flex-col gap-4">
      <header className="animate-rise px-1 pt-2">
        <h1 className="text-[2rem] font-semibold tracking-tight">
          Bereiche<span className="text-glow-400">.</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Backlog und Notizen für jeden Lebensbereich.</p>
      </header>

      <div className="grid gap-3">
        {stats.map(({ w, open, byType, notes: n }, i) => {
          const t = tone(w.color);
          return (
            <Link
              key={w.id}
              href={`/bereiche/${w.key}`}
              className="glass group animate-rise rounded-3xl p-4 transition-all duration-300 ease-[var(--ease-fluid)] hover:border-white/20 active:scale-[0.99]"
              style={{ animationDelay: `${60 + i * 60}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className={`grid size-11 place-items-center rounded-2xl ${t.bg} ${t.text}`}>
                  <WsIcon name={w.icon} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{w.name}</p>
                  <p className="truncate text-xs text-ink-muted">{w.description}</p>
                </div>
                <ChevronRight className="size-4 text-ink-faint transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1">{open} offen</span>
                {(Object.keys(byType) as TaskType[]).map((k) => (
                  <span key={k} className="rounded-full px-2.5 py-1 text-ink-muted ring-1 ring-white/[0.06]">
                    {byType[k]} {byType[k] === 1 ? TASK_TYPE_LABEL[k].one : TASK_TYPE_LABEL[k].many}
                  </span>
                ))}
                {n > 0 && <span className="rounded-full px-2.5 py-1 text-ink-muted ring-1 ring-white/[0.06]">{n} Notizen</span>}
              </div>
            </Link>
          );
        })}

        <Link href="/einkauf" className="glass flex animate-rise items-center gap-3 rounded-3xl p-4 [animation-delay:260ms] hover:border-white/20">
          <span className="grid size-11 place-items-center rounded-2xl bg-amber-300/12 text-amber-200">
            <ShoppingBasket className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-medium">Einkaufsliste</p>
            <p className="text-xs text-ink-muted">{openShopping ? `${openShopping} offen` : "leer"}</p>
          </div>
          <ChevronRight className="size-4 text-ink-faint" />
        </Link>
      </div>

      <section className="glass animate-rise rounded-3xl p-5 [animation-delay:320ms]">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            <Sparkles className="size-4 text-glow-300" /> KI-Planung
          </h2>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setMsg(null);
                const r = await scanBacklog(true);
                setMsg(!r.ok ? r.error : r.created ? `${r.created} neue Vorschläge` : "Gerade nichts Neues einzuplanen.");
                if (r.ok && r.created) router.refresh();
              })
            }
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-ink-muted hover:bg-white/5 hover:text-ink"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <WandSparkles className="size-3.5" />} Neu planen
          </button>
        </header>
        {pendingSugg.length === 0 ? (
          <p className="text-sm text-ink-muted">Gemini prüft einmal täglich Aufgaben ohne Datum und schlägt passende Zeitpunkte vor.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendingSugg.map((s) => {
              const task = tasks.find((t) => t.id === s.task_id);
              if (!task) return null;
              return (
                <li key={s.id} className="flex items-start gap-3 rounded-2xl bg-white/[0.035] p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{task.title}</p>
                    <p className="text-xs text-glow-300/90">
                      {formatShort(s.starts_at, s.all_day)} <span className="text-ink-faint">· {formatRelative(s.starts_at)}</span>
                    </p>
                    {s.reason && <p className="mt-1 text-xs text-ink-muted">{s.reason}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => actions.dismissSuggestion(s.id)} className="rounded-lg px-2 py-1.5 text-xs text-ink-muted hover:bg-white/5">
                      Nein
                    </button>
                    <button onClick={() => actions.acceptSuggestion(s.id)} className="rounded-lg bg-glow-400/90 px-2.5 py-1.5 text-xs font-medium text-abyss-950">
                      Einplanen
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {msg && <p className="mt-3 text-xs text-ink-muted">{msg}</p>}
      </section>
    </div>
  );
}
