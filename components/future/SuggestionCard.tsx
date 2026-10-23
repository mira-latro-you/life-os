"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Loader2, X } from "lucide-react";
import { acceptSuggestion, dismissSuggestion } from "@/app/actions/future";
import { formatRelative, formatShort } from "@/lib/dates";
import type { SuggestionWithItem } from "@/lib/types";

export function SuggestionCard({ s }: { s: SuggestionWithItem }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "accepted" | "dismissed">("idle");
  const [pending, startTransition] = useTransition();

  function run(action: "accept" | "dismiss") {
    startTransition(async () => {
      const r = action === "accept" ? await acceptSuggestion(s.id) : await dismissSuggestion(s.id);
      if (r.ok) {
        setState(action === "accept" ? "accepted" : "dismissed");
        setTimeout(() => router.refresh(), 450);
      }
    });
  }

  if (state === "dismissed") return null;

  return (
    <li
      className={`flex items-start gap-3 rounded-2xl px-3 py-3 transition-all duration-500 ease-[var(--ease-fluid)] ${
        state === "accepted" ? "bg-emerald-400/10 ring-1 ring-emerald-300/20" : "bg-white/[0.035]"
      }`}
    >
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-glow-400/12 text-glow-300">
        {state === "accepted" ? <Check className="size-4 text-emerald-300" /> : <CalendarPlus className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{s.future_items?.title ?? "Eintrag"}</p>
        <p className="mt-0.5 text-xs text-glow-300/90">
          {formatShort(s.starts_at, s.all_day)} <span className="text-ink-faint">· {formatRelative(s.starts_at)}</span>
        </p>
        {s.reason && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{s.reason}</p>}
      </div>
      {state === "idle" && (
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => run("dismiss")}
            disabled={pending}
            aria-label="Vorschlag verwerfen"
            className="grid size-8 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            <X className="size-4" />
          </button>
          <button
            onClick={() => run("accept")}
            disabled={pending}
            aria-label="In den Kalender übernehmen"
            className="grid size-8 place-items-center rounded-xl bg-glow-400/90 text-abyss-950 transition-all hover:bg-glow-300 active:scale-95"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          </button>
        </div>
      )}
    </li>
  );
}
