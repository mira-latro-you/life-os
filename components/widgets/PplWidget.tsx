"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { logWorkout } from "@/app/actions/widgets";
import { nextPplSplit, PPL_CYCLE, PPL_HINT, PPL_LABEL, type PplSplit } from "@/lib/widgets";
import { berlinDateString, formatDayLabel } from "@/lib/dates";
import type { WidgetWithEntries } from "@/lib/types";

export function PplWidget({ widget }: { widget: WidgetWithEntries }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [justLogged, setJustLogged] = useState<PplSplit | null>(null);

  const sessions = widget.entries.filter((e) => PPL_CYCLE.includes(e.data.split as PplSplit));
  const next = nextPplSplit(sessions);
  const trainedToday = sessions.some((e) => berlinDateString(new Date(e.occurred_at)) === berlinDateString());
  const weekAgo = Date.now() - 7 * 86_400_000;
  const thisWeek = sessions.filter((e) => new Date(e.occurred_at).getTime() > weekAgo).length;
  const last = sessions[0];

  function log(split: PplSplit) {
    startTransition(async () => {
      const r = await logWorkout(widget.id, split);
      if (r.ok) {
        setJustLogged(split);
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-muted">{trainedToday ? "Heute erledigt · als Nächstes" : "Heute dran"}</p>
          <p className="mt-0.5 text-3xl font-semibold tracking-tight">
            {PPL_LABEL[next]}
            <span className="text-glow-400">.</span>
          </p>
          <p className="text-xs text-ink-muted">{PPL_HINT[next]}</p>
        </div>
        <button
          onClick={() => log(next)}
          disabled={pending}
          className="flex items-center gap-2 rounded-xl bg-glow-400/90 px-4 py-2.5 text-sm font-medium text-abyss-950 transition-all duration-300 hover:bg-glow-300 active:scale-95 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Erledigt
        </button>
      </div>

      {/* Verlauf: letzte 9 Einheiten als Punkte */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex gap-1.5" aria-label="Letzte Einheiten">
          {Array.from({ length: 9 }).map((_, i) => {
            const s = sessions[8 - i];
            return (
              <span
                key={i}
                title={s ? `${PPL_LABEL[s.data.split as PplSplit]} · ${formatDayLabel(s.occurred_at)}` : undefined}
                className={`grid size-6 place-items-center rounded-lg text-[10px] font-medium uppercase ${
                  s ? "bg-glow-400/15 text-glow-300" : "border border-dashed border-white/10 text-transparent"
                }`}
              >
                {s ? String(s.data.split).charAt(0) : "·"}
              </span>
            );
          })}
        </div>
        <span className="ml-auto text-right text-xs text-ink-muted">
          <span className="block text-sm font-medium text-ink">{thisWeek}×</span>
          letzte 7 Tage
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1 border-t border-white/5 pt-3 text-xs text-ink-muted">
        <span className="mr-1">{last ? `Zuletzt: ${PPL_LABEL[last.data.split as PplSplit]}, ${formatDayLabel(last.occurred_at)}` : "Noch keine Einheit"}</span>
        <span className="ml-auto">anderes:</span>
        {PPL_CYCLE.filter((s) => s !== next).map((s) => (
          <button
            key={s}
            onClick={() => log(s)}
            disabled={pending}
            className={`rounded-full px-2.5 py-1 transition-colors hover:bg-white/5 hover:text-ink ${justLogged === s ? "text-glow-300" : ""}`}
          >
            {PPL_LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
