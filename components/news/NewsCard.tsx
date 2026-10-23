"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Newspaper, RefreshCw, Sun } from "lucide-react";
import { formatRelative } from "@/lib/dates";
import type { NewsCategory, NewsItem } from "@/lib/types";

type Filter = "all" | "good" | NewsCategory;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "good", label: "Good News" },
  { value: "ki", label: "KI" },
  { value: "ecommerce", label: "E-Commerce" },
  { value: "tech", label: "Tech" },
  { value: "wirtschaft", label: "Wirtschaft" },
];

/** News-Feed mit Kategorie- und Good-News-Filter (Auswahl wird auf dem Gerät gemerkt). */
export function NewsCard() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(6);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lifeos-news-filter") as Filter | null;
      if (saved && FILTERS.some((f) => f.value === saved)) setFilter(saved);
    } catch {
      /* egal */
    }
    load(false);
  }, []);

  function load(refresh: boolean) {
    setLoading(true);
    setError(false);
    fetch(`/api/news${refresh ? "?refresh=1" : ""}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { items: NewsItem[] }) => setItems(d.items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  function choose(f: Filter) {
    setFilter(f);
    setLimit(6);
    try {
      localStorage.setItem("lifeos-news-filter", f);
    } catch {
      /* egal */
    }
  }

  const shown = useMemo(() => {
    if (!items) return [];
    if (filter === "all") return items;
    if (filter === "good") return items.filter((n) => n.positive);
    return items.filter((n) => n.category === filter);
  }, [items, filter]);

  return (
    <section className="glass animate-rise rounded-3xl p-5 [animation-delay:360ms]">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">
          <Newspaper className="size-4" /> News
        </h2>
        <button onClick={() => load(true)} disabled={loading} aria-label="Neu laden" className="grid size-7 place-items-center rounded-full text-ink-faint hover:bg-white/5 hover:text-ink">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      <div className="no-scrollbar -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => choose(f.value)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs transition-all ${
              filter === f.value ? (f.value === "good" ? "bg-amber-300/15 text-amber-200 ring-1 ring-amber-300/30" : "bg-white/[0.12] text-ink ring-1 ring-white/15") : "text-ink-muted hover:text-ink"
            }`}
          >
            {f.value === "good" && <Sun className="size-3" />}
            {f.label}
          </button>
        ))}
      </div>

      {items === null && !error ? (
        <div className="flex items-center gap-2 py-4 text-sm text-ink-muted">
          <Loader2 className="size-4 animate-spin" /> Lade Schlagzeilen und sortiere sie mit Gemini…
        </div>
      ) : error ? (
        <p className="py-3 text-sm text-ink-muted">News gerade nicht erreichbar.</p>
      ) : shown.length === 0 ? (
        <p className="py-3 text-sm text-ink-muted">Keine Meldungen in dieser Kategorie.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {shown.slice(0, limit).map((n) => (
            <li key={n.id}>
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="group block rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.04]">
                <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-faint">
                  {n.positive && <Sun className="size-3 text-amber-300" />}
                  <span className="text-glow-400/80">{n.source}</span>· {formatRelative(n.published)}
                  <ExternalLink className="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="mt-0.5 block text-[15px] leading-snug text-ink/90">{n.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {shown.length > limit && (
        <button onClick={() => setLimit((l) => l + 8)} className="mt-1 w-full rounded-xl py-2 text-xs text-ink-muted hover:bg-white/[0.04] hover:text-ink">
          Mehr anzeigen ({shown.length - limit})
        </button>
      )}
    </section>
  );
}
