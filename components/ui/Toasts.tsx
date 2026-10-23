"use client";

import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { useLife } from "@/lib/store/provider";

export function Toasts() {
  const toasts = useLife((s) => s.toasts);
  const dismiss = useLife((s) => s.dismissToast);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[80] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const Icon = t.tone === "error" ? TriangleAlert : t.tone === "success" ? CheckCircle2 : Info;
        return (
          <div key={t.id} className="glass-strong pointer-events-auto flex w-full max-w-md animate-rise items-center gap-3 rounded-2xl px-4 py-3 text-sm">
            <Icon className={`size-4 shrink-0 ${t.tone === "error" ? "text-rose-300" : t.tone === "success" ? "text-emerald-300" : "text-glow-300"}`} />
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action?.run();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-glow-300 hover:bg-white/5"
              >
                {t.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
