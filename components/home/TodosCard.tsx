import { ListTodo } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { TodoCheck } from "./TodoCheck";
import { formatShort } from "@/lib/dates";
import type { LifeEvent } from "@/lib/types";

export function TodosCard({ todos }: { todos: LifeEvent[] }) {
  const now = Date.now();
  return (
    <GlassCard title="Aufgaben" icon={<ListTodo className="size-4" />} delay={240}>
      {todos.length === 0 ? (
        <p className="text-sm text-ink-muted">Alles erledigt. ✨</p>
      ) : (
        <ul className="flex flex-col">
          {todos.map((t) => {
            const overdue = t.starts_at && new Date(t.starts_at).getTime() < now && !t.all_day;
            return (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <TodoCheck id={t.id} />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                {t.starts_at && (
                  <span className={`shrink-0 text-xs ${overdue ? "text-rose-300" : "text-ink-muted"}`}>
                    {formatShort(t.starts_at, t.all_day)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
