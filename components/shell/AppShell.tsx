"use client";

import { BottomNav } from "@/components/nav/BottomNav";
import { Editors } from "@/components/editors/Editors";
import { Toasts } from "@/components/ui/Toasts";
import { Sheet } from "@/components/ui/Sheet";
import { BrainDump } from "@/components/brain/BrainDump";
import { AutoScan } from "./AutoScan";
import { useLife } from "@/lib/store/provider";

/** Rahmen für alle eingeloggten Seiten: Inhalt, Navigation, globale Sheets. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const brainOpen = useLife((s) => s.brainOpen);
  const setBrainOpen = useLife((s) => s.setBrainOpen);

  return (
    <>
      <main className="mx-auto w-full max-w-xl px-4 pb-[calc(env(safe-area-inset-bottom)+7.5rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        {children}
      </main>
      <BottomNav />
      <Sheet open={brainOpen} onClose={() => setBrainOpen(false)} title="Brain Dump">
        <p className="mb-3 text-sm text-ink-muted">Schreib oder sprich einfach drauflos – ich sortiere es in Kalender, Backlog, Einkauf oder Notizen.</p>
        <BrainDump autoFocus onDone={() => setBrainOpen(false)} />
        <div className="h-3" />
      </Sheet>
      <Editors />
      <Toasts />
      <AutoScan />
    </>
  );
}
