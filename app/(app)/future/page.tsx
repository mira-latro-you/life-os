import { Lightbulb, Telescope } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getFutureItems, getPendingSuggestions } from "@/lib/data/future";
import { GlassCard } from "@/components/ui/GlassCard";
import { FutureComposer } from "@/components/future/FutureComposer";
import { FutureItemRow } from "@/components/future/FutureItemRow";
import { SuggestionPanel } from "@/components/future/SuggestionPanel";
import type { FutureCategory } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Future Log · Life OS" };

const ORDER: FutureCategory[] = ["aufgabe", "projekt", "idee"];
const PLURAL: Record<FutureCategory, string> = { aufgabe: "Aufgaben", projekt: "Projekte", idee: "Ideen" };

export default async function FuturePage() {
  const { supabase } = await requireUser();
  const [rows, suggestions] = await Promise.all([getFutureItems(supabase), getPendingSuggestions(supabase)]);

  const open = rows.filter((r) => r.item.status === "open");
  const scheduled = rows.filter((r) => r.item.status === "scheduled");

  return (
    <div className="flex flex-col gap-4">
      <header className="animate-rise px-1 pt-2">
        <h1 className="flex items-center gap-2 text-[2rem] font-semibold tracking-tight">
          Future Log<span className="text-glow-400">.</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Alles ohne festes Datum. Gemini plant es für dich ein.</p>
      </header>

      <FutureComposer />
      <SuggestionPanel suggestions={suggestions} openCount={open.length} />

      {ORDER.map((cat, i) => {
        const list = open.filter((r) => r.item.category === cat);
        if (list.length === 0) return null;
        return (
          <GlassCard
            key={cat}
            title={PLURAL[cat]}
            icon={cat === "idee" ? <Lightbulb className="size-4" /> : <Telescope className="size-4" />}
            delay={260 + i * 60}
          >
            <ul className="-my-1 divide-y divide-white/5">
              {list.map(({ item }) => (
                <FutureItemRow key={item.id} item={item} />
              ))}
            </ul>
          </GlassCard>
        );
      })}

      {scheduled.length > 0 && (
        <GlassCard title="Eingeplant" delay={440} className="opacity-80">
          <ul className="-my-1 divide-y divide-white/5">
            {scheduled.map(({ item, scheduledAt }) => (
              <FutureItemRow key={item.id} item={item} scheduledAt={scheduledAt} />
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
