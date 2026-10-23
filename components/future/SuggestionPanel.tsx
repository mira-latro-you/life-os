"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Loader2, Sparkles, WandSparkles } from "lucide-react";
import { SuggestionCard } from "./SuggestionCard";
import { acceptAllSuggestions, scanFutureLog } from "@/app/actions/future";
import type { SuggestionWithItem } from "@/lib/types";

interface Props {
  suggestions: SuggestionWithItem[];
  /** Kompakte Variante für den Homescreen */
  compact?: boolean;
  openCount?: number;
}

export function SuggestionPanel({ suggestions, compact = false, openCount = 0 }: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shown = compact ? suggestions.slice(0, 2) : suggestions;

  function scan() {
    setMsg(null);
    startTransition(async () => {
      const r = await scanFutureLog(true);
      if (!r.ok) return setMsg(r.error);
      const n = r.data?.created ?? 0;
      setMsg(n === 0 ? "Gerade nichts Neues einzuplanen." : `${n} ${n === 1 ? "neuer Vorschlag" : "neue Vorschläge"}.`);
      router.refresh();
    });
  }

  function acceptAll() {
    startTransition(async () => {
      const r = await acceptAllSuggestions();
      if (r.ok) setMsg(`${r.data?.count ?? 0} in den Kalender übernommen.`);
      router.refresh();
    });
  }

  return (
    <section className="glass animate-rise rounded-3xl p-5 [animation-delay:200ms]">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">
          <Sparkles className="size-4 text-glow-300" />
          Vorschläge
        </h2>
        {compact ? (
          <Link href="/future" className="flex items-center text-xs text-ink-muted transition-colors hover:text-ink">
            Future Log <ChevronRight className="size-3.5" />
          </Link>
        ) : (
          <div className="flex items-center gap-1">
            {suggestions.length > 1 && (
              <button
                onClick={acceptAll}
                disabled={pending}
                className="rounded-full px-3 py-1.5 text-xs text-glow-300 transition-colors hover:bg-glow-400/10"
              >
                Alle übernehmen
              </button>
            )}
            <button
              onClick={scan}
              disabled={pending || openCount === 0}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-ink-muted transition-colors hover:bg-white/5 hover:text-ink disabled:opacity-40"
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <WandSparkles className="size-3.5" />}
              Neu planen
            </button>
          </div>
        )}
      </header>

      {shown.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {openCount === 0
            ? "Leg unten etwas ohne Datum an – Gemini schlägt dir dann passende Zeitpunkte vor."
            : "Keine offenen Vorschläge. Gemini schaut automatisch einmal täglich nach."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((s) => (
            <SuggestionCard key={s.id} s={s} />
          ))}
        </ul>
      )}
      {compact && suggestions.length > shown.length && (
        <Link href="/future" className="mt-3 block text-center text-xs text-ink-muted hover:text-ink">
          + {suggestions.length - shown.length} weitere
        </Link>
      )}
      {msg && <p className="mt-3 text-xs text-ink-muted">{msg}</p>}
    </section>
  );
}
