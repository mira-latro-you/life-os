import { Newspaper } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { getHeadlines } from "@/lib/news";
import { formatTime } from "@/lib/dates";

export async function NewsFeed() {
  const items = await getHeadlines(5);
  if (items.length === 0) return null; // unaufdringlich: bei Fehler einfach ausblenden

  return (
    <GlassCard title="Schlagzeilen" icon={<Newspaper className="size-4" />} delay={320} className="opacity-90">
      <ul className="-mx-2 flex flex-col">
        {items.map((n) => (
          <li key={n.id}>
            <a
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl px-2 py-2.5 transition-colors duration-200 hover:bg-white/[0.04] active:bg-white/[0.06]"
            >
              {n.topline && (
                <span className="block text-[11px] uppercase tracking-wider text-glow-400/80">{n.topline}</span>
              )}
              <span className="block text-[15px] leading-snug text-ink/90">{n.title}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ink-faint">tagesschau.de · Stand {formatTime(new Date().toISOString())}</p>
    </GlassCard>
  );
}

export function NewsFeedSkeleton() {
  return (
    <div className="glass rounded-3xl p-5 opacity-60">
      <div className="mb-4 h-3 w-28 rounded-full bg-white/10" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-3 h-4 animate-pulse rounded-full bg-white/[0.06]" style={{ width: `${88 - i * 12}%` }} />
      ))}
    </div>
  );
}
