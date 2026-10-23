"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowUp, BrainCircuit, CalendarPlus, Check, ListTodo, Loader2, Mic, NotebookPen, ShoppingBasket, Square, Undo2 } from "lucide-react";
import { brainDump, type RoutedResult } from "@/app/actions/brain";
import { useActions, useLife } from "@/lib/store/provider";
import { formatShort } from "@/lib/dates";
import { TASK_TYPE_LABEL, tone } from "@/components/ui/tokens";
import { useVoice } from "./useVoice";
import type { TableName } from "@/lib/store/store";
import type { TaskType } from "@/lib/types";

const ROUTE_META = {
  event: { icon: CalendarPlus, label: "Kalender" },
  task: { icon: ListTodo, label: "Backlog" },
  shopping: { icon: ShoppingBasket, label: "Einkauf" },
  note: { icon: NotebookPen, label: "Notiz" },
} as const;

const EXAMPLES = ["Morgen 18 Uhr Padel", "Nächste Woche Serhat nach mehr Verantwortung fragen", "Holz fürs Stückle kaufen"];

/**
 * AI Brain Dump – alles ungefiltert rein, Gemini routet in Kalender, Backlog, Einkauf oder Notizen.
 * Mehrere Gedanken in einer Eingabe werden getrennt erkannt.
 */
export function BrainDump({ autoFocus = false, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const actions = useActions();
  const workspaces = useLife((s) => s.workspaces);
  const [text, setText] = useState("");
  const [results, setResults] = useState<RoutedResult[]>([]);
  const [undone, setUndone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = (payload: { text?: string; audio?: { mimeType: string; data: string } }) => {
    setError(null);
    startTransition(async () => {
      const r = await brainDump(payload);
      if (!r.ok) return setError(r.error);
      // sofort in den Store, Realtime-Echo wird dedupliziert
      for (const res of r.results) actions.upsertLocal(res.table as TableName, [res.row]);
      setResults(r.results);
      setUndone(new Set());
      setText("");
      ref.current?.blur();
    });
  };

  const voice = useVoice({
    onText: (t, final) => {
      setText(t);
      if (final && t.trim()) submit({ text: t });
    },
    onAudio: (audio) => submit({ audio }),
  });

  function undo(r: RoutedResult) {
    setUndone((s) => new Set(s).add(r.row.id));
    actions.remove(r.table as TableName, r.row.id);
  }

  const busy = pending;

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) submit({ text });
        }}
        className="glass-strong group relative rounded-[22px] p-2 transition-all duration-300 ease-[var(--ease-fluid)] focus-within:border-glow-400/40 focus-within:shadow-[0_0_0_4px_rgb(110_168_255/0.08),0_18px_50px_-16px_rgb(1_4_20/0.85)]"
      >
        <div className="flex items-start gap-2">
          <BrainCircuit className={`ml-2 mt-3 size-5 shrink-0 ${busy ? "animate-pulse text-glow-300" : "text-glow-400/80"}`} />
          <textarea
            ref={ref}
            autoFocus={autoFocus}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (text.trim()) submit({ text });
              }
            }}
            rows={text.length > 60 ? 3 : 1}
            placeholder={voice.listening ? "Ich höre zu…" : "Brain Dump – einfach alles rein"}
            aria-label="Brain Dump"
            disabled={busy}
            className="min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
          />
          {voice.supported && (
            <button
              type="button"
              onClick={() => (voice.listening ? voice.stop() : voice.start(text))}
              disabled={busy}
              aria-label={voice.listening ? "Aufnahme beenden" : "Spracheingabe"}
              className={`grid size-10 shrink-0 place-items-center rounded-xl transition-all duration-300 active:scale-95 ${
                voice.listening ? "bg-rose-400/20 text-rose-200 ring-1 ring-rose-300/40" : "text-ink-muted hover:bg-white/5 hover:text-ink"
              }`}
            >
              {voice.listening ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label="Verarbeiten"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-glow-400/90 text-abyss-950 transition-all duration-300 hover:bg-glow-300 active:scale-95 disabled:bg-white/10 disabled:text-ink-faint"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
          </button>
        </div>
        {voice.listening && (
          <div className="mx-3 mb-1 mt-1 flex items-center gap-2 text-xs text-rose-200/90">
            <span className="size-1.5 animate-pulse rounded-full bg-rose-300" />
            {voice.mode === "speech" ? "Sprich einfach – zum Abschicken stoppen" : "Aufnahme läuft – zum Senden stoppen"}
          </div>
        )}
      </form>

      {!text && results.length === 0 && !error && !busy && (
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setText(ex);
                ref.current?.focus();
              }}
              className="shrink-0 rounded-full border border-white/[0.07] px-3 py-1.5 text-xs text-ink-faint transition-colors hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {(error || voice.error) && <p className="px-2 text-xs text-rose-300">{error ?? voice.error}</p>}

      {results.length > 0 && (
        <ul className="glass animate-rise rounded-2xl p-2">
          {results.map((r) => {
            const meta = ROUTE_META[r.route];
            const Icon = meta.icon;
            const ws = workspaces.find((w) => w.key === r.workspaceKey);
            const gone = undone.has(r.row.id);
            const row = r.row as Record<string, string | null | boolean>;
            const detail =
              r.route === "event" && row.starts_at
                ? formatShort(String(row.starts_at), Boolean(row.all_day))
                : r.route === "task"
                  ? [TASK_TYPE_LABEL[(row.type as TaskType) ?? "task"]?.one, row.project, row.due_at ? `fällig ${formatShort(String(row.due_at), true).split(" · ")[0]}` : null].filter(Boolean).join(" · ")
                  : r.route === "shopping"
                    ? [row.quantity, row.store].filter(Boolean).join(" · ")
                    : "";
            return (
              <li key={r.row.id} className={`flex items-center gap-3 rounded-xl px-2 py-2 transition-opacity ${gone ? "opacity-35" : ""}`}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${tone(ws?.color).bg} ${tone(ws?.color).text}`}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${gone ? "line-through" : ""}`}>{String(row.title ?? "")}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {meta.label}
                    {r.route !== "shopping" && ws ? ` · ${ws.name}` : ""}
                    {detail ? ` · ${detail}` : ""}
                  </p>
                </div>
                {gone ? (
                  <span className="text-xs text-ink-faint">entfernt</span>
                ) : (
                  <button onClick={() => undo(r)} aria-label="Rückgängig" className="grid size-8 place-items-center rounded-lg text-ink-faint hover:bg-white/5 hover:text-ink">
                    <Undo2 className="size-4" />
                  </button>
                )}
              </li>
            );
          })}
          <li className="flex items-center justify-between px-2 pb-1 pt-2 text-xs text-ink-faint">
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-emerald-300" /> {results.length} {results.length === 1 ? "Eintrag" : "Einträge"} einsortiert
            </span>
            <button
              onClick={() => {
                setResults([]);
                onDone?.();
              }}
              className="rounded-lg px-2 py-1 hover:bg-white/5 hover:text-ink"
            >
              Fertig
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
