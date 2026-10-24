"use client";

import { useEffect, useState, useTransition } from "react";
import { Briefcase, ChevronDown, Dumbbell, ExternalLink, Quote, RefreshCw, Sparkles, Sun } from "lucide-react";
import { regenerateBriefing } from "@/app/actions/ai";
import { formatTime } from "@/lib/dates";
import type { BriefingContent } from "@/lib/types";

const OPEN_KEY = "lifeos.briefing.more";

/**
 * Daily AI Briefing – bewusst knapp: ein Satz zum Tag, zwei Chips (Training, Arbeitsfokus).
 * Gute Nachrichten und Zitat liegen zugeklappt darunter.
 */
export function BriefingView({ initial }: { initial: BriefingContent }) {
  const [b, setB] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [more, setMore] = useState(false);

  useEffect(() => {
    try {
      setMore(localStorage.getItem(OPEN_KEY) === "1");
    } catch {}
  }, []);
  const toggleMore = () =>
    setMore((m) => {
      try {
        localStorage.setItem(OPEN_KEY, m ? "0" : "1");
      } catch {}
      return !m;
    });

  const extras = [b.news.length ? `${b.news.length} gute ${b.news.length === 1 ? "Nachricht" : "Nachrichten"}` : null, "Zitat des Tages"].filter(Boolean).join(" · ");

  return (
    <section className="glass relative animate-rise overflow-hidden rounded-3xl p-5 [animation-delay:120ms]">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-glow-400/15 blur-3xl" />

      <header className="relative flex items-center justify-between">
        <p className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">
          <Sparkles className="size-4 text-glow-300" /> Daily Briefing
        </p>
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

      <p className="relative mt-3 text-[17px] leading-snug text-ink">{b.summary}</p>

      <div className="relative mt-3 flex flex-wrap gap-2">
        {b.training && (
          <Chip icon={<Dumbbell className="size-3.5" />} className="bg-emerald-400/10 text-emerald-200">
            {b.training}
          </Chip>
        )}
        {b.workFocus && (
          <Chip icon={<Briefcase className="size-3.5" />} className="bg-glow-400/10 text-glow-300">
            {b.workFocus}
          </Chip>
        )}
      </div>

      <button
        onClick={toggleMore}
        aria-expanded={more}
        className="relative mt-4 flex w-full items-center gap-1.5 border-t border-white/5 pt-3 text-xs text-ink-muted hover:text-ink"
      >
        <ChevronDown className={`size-3.5 transition-transform duration-200 ${more ? "rotate-180" : ""}`} /> {extras}
      </button>

      {more && (
        <div className="relative mt-3 flex animate-[fade_200ms_ease-out] flex-col gap-3">
          {b.news.length > 0 && (
            <ul className="flex flex-col gap-2">
              {b.news.map((n) => (
                <li key={n.url}>
                  <a href={n.url} target="_blank" rel="noreferrer" className="group flex items-start gap-2 text-sm leading-snug">
                    <Sun className="mt-0.5 size-3.5 shrink-0 text-amber-200/80" />
                    <span className="flex-1 text-ink/85 group-hover:text-ink">
                      {n.title} <span className="text-[11px] text-ink-faint">· {n.source}</span>
                    </span>
                    <ExternalLink className="mt-0.5 size-3 shrink-0 text-ink-faint" />
                  </a>
                </li>
              ))}
            </ul>
          )}
          <figure className="flex gap-2">
            <Quote className="mt-0.5 size-3.5 shrink-0 text-violet-300/80" />
            <p className="text-sm italic leading-relaxed text-ink/80">
              {b.quote.text} <span className="not-italic text-[11px] text-ink-faint">— {b.quote.author}</span>
            </p>
          </figure>
        </div>
      )}
    </section>
  );
}

function Chip({ icon, className, children }: { icon: React.ReactNode; className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] ${className}`}>
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}
