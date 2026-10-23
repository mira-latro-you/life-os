import { requireUser } from "@/lib/auth";
import { getWidgets } from "@/lib/data/widgets";
import { WidgetManager } from "@/components/widgets/WidgetManager";
import { WidgetCard } from "@/components/widgets/WidgetCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Routinen · Life OS" };

export default async function RoutinenPage() {
  const { supabase } = await requireUser();
  const widgets = await getWidgets(supabase);

  return (
    <div className="flex flex-col gap-4">
      <header className="animate-rise px-1 pt-2">
        <h1 className="text-[2rem] font-semibold tracking-tight">
          Routinen<span className="text-glow-400">.</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Tracker für deinen Alltag. Angepinnte erscheinen auf „Heute“.</p>
      </header>

      <WidgetManager widgets={widgets} />

      {widgets.map((w, i) => (
        <WidgetCard key={w.id} widget={w} delay={240 + i * 60} showManage={false} />
      ))}
    </div>
  );
}
