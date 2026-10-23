import { requireUser } from "@/lib/auth";
import { loadSnapshot } from "@/lib/data/snapshot";
import { StoreProvider } from "@/lib/store/provider";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

/**
 * Lädt einmal alle Daten (Snapshot) und hydratisiert damit den globalen Store.
 * Navigation zwischen den Seiten passiert danach ohne neue Ladezeiten.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const snapshot = await loadSnapshot(supabase, user.id);

  return (
    <StoreProvider snapshot={snapshot}>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
