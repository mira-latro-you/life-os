"use client";

import { useState, useTransition } from "react";
import { Briefcase, Dumbbell, ExternalLink, Quote, RefreshCw, Sparkles, Sun } from "lucide-react";
import { regenerateBriefing } from "@/app/actions/ai";
import { formatTime } from "@/lib/dates";
import type { BriefingContent } from "@/lib/types";

/** Daily AI Briefing – Begrüßung, Tagesplan, Training, Arbeitsfokus, Good News, Zitat. */
export function BriefingView({ initial }: { initial: BriefingContent }) {
  const [b, setB] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(true);

  return (
    <section className="glass relative animate-rise overflow-hidden rounded-3xl p-5 [animation-delay:120ms]">
      {/* sanfter Lichtschein */}
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-glow-400/15 blur-3xl" />

      <header className="relative flex items-center justify-between">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">
          <Sparkles className="size-4 text-glow-300" /> Daily Briefing
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await regenerateBriefing();
              if (r.ok) setB(r.briefing);
            })
          }
          aria-label="Briefing neu erstellen"
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-ink-faint hover:bg-white/5 hover:text-ink"
        >
          <RefreshCw className={`size-3 ${pending ? "animate-spin" : ""}`} /> {formatTime(b.generatedAt)}
        </button>
      </header>

      <p className="relative mt-3 text-xl font-semibold tracking-tight">{b.greeting}</p>
      <p className="relative mt-1 leading-relaxed text-ink/90">{b.summary}</p>

      {open && (
        <div className="relative mt-4 flex flex-col gap-3">
          <Line icon={<Dumbbell className="size-4" />} tone="text-emerald-300">
            {b.training}
          </Line>
          {b.workFocus && (
            <Line icon={<Briefcase className="size-4" />} tone="text-glow-300">
              {b.workFocus}
            </Line>
          )}

          {b.news.length > 0 && (
            <div className="rounded-2xl bg-white/[0.035] p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-amber-200/90">
                <Sun className="size-3.5" /> Gute Nachrichten
              </p>
              <ul className="flex flex-col gap-1.5">
                {b.news.map((n) => (
                  <li key={n.url}>
                    <a href={n.url} target="_blank" rel="noreferrer" className="group flex items-start gap-2 text-sm leading-snug hover:text-ink">
                      <span className="flex-1 text-ink/85 group-hover:text-ink">{n.title}</span>
                      <ExternalLink className="mt-0.5 size-3 shrink-0 text-ink-faint" />
                    </a>
                    <span className="text-[11px] text-ink-faint">{n.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <figure className="flex gap-2 border-t border-white/5 pt-3">
            <Quote className="mt-0.5 size-4 shrink-0 text-violet-300/80" />
            <div>
              <blockquote className="text-sm italic leading-relaxed text-ink/85">{b.quote.text}</blockquote>
              <figcaption className="mt-1 text-[11px] text-ink-faint">— {b.quote.author}</figcaption>
            </div>
          </figure>
        </div>
      )}
    </section>
  );
}

function Line({ icon, tone, children }: { icon: React.ReactNode; tone: string; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink/85">
      <span className={`mt-0.5 shrink-0 ${tone}`}>{icon}</span>
      <span>{children}</span>
    </p>
  );
}
