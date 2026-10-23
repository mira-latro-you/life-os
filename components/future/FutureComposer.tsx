"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Plus } from "lucide-react";
import { addFutureItem } from "@/app/actions/future";
import { CATEGORY_META, HORIZON_PRESETS } from "./meta";
import type { FutureCategory } from "@/lib/types";

export function FutureComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<FutureCategory>("aufgabe");
  const [horizon, setHorizon] = useState("");
  const [showHorizon, setShowHorizon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      const r = await addFutureItem({ title, category, horizon });
      if (!r.ok) return setError(r.error);
      setTitle("");
      setHorizon("");
      setShowHorizon(false);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="glass-strong animate-rise rounded-3xl p-4 [animation-delay:80ms]">
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="z. B. Auto zur Inspektion"
          aria-label="Neuer Eintrag im Future Log"
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[16px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !title.trim()}
          aria-label="Hinzufügen"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-glow-400/90 text-abyss-950 transition-all duration-300 hover:bg-glow-300 active:scale-95 disabled:bg-white/10 disabled:text-ink-faint"
        >
          {pending ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {(Object.keys(CATEGORY_META) as FutureCategory[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all duration-300 ${
              category === c ? "bg-white/[0.12] text-ink ring-1 ring-white/15" : "text-ink-muted hover:text-ink"
            }`}
          >
            <span className={`size-1.5 rounded-full ${CATEGORY_META[c].dot}`} />
            {CATEGORY_META[c].label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowHorizon((v) => !v)}
          aria-expanded={showHorizon}
          className={`ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
            horizon ? "text-glow-300" : "text-ink-muted hover:text-ink"
          }`}
        >
          <CalendarClock className="size-3.5" />
          {horizon || "Wann ungefähr?"}
        </button>
      </div>

      {showHorizon && (
        <div className="mt-3 flex animate-rise flex-wrap gap-1.5 border-t border-white/5 pt-3">
          {HORIZON_PRESETS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(horizon === h ? "" : h)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                horizon === h ? "border-glow-400/50 bg-glow-400/15 text-glow-300" : "border-white/10 text-ink-muted hover:text-ink"
              }`}
            >
              {h}
            </button>
          ))}
          <input
            value={HORIZON_PRESETS.includes(horizon) ? "" : horizon}
            onChange={(e) => setHorizon(e.target.value)}
            placeholder="eigene Angabe…"
            className="min-w-28 flex-1 rounded-full border border-white/10 bg-transparent px-3 py-1 text-[16px] text-ink placeholder:text-ink-faint focus:border-glow-400/40 focus:outline-none sm:text-xs"
          />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </form>
  );
}
