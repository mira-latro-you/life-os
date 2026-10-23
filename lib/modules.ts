import { Blocks, CalendarDays, Home, Layers3, Settings2, ShoppingBasket, type LucideIcon } from "lucide-react";

/**
 * Modul-Registry: Navigation und Routen der App an einer Stelle.
 *
 * Neues Modul andocken (z. B. „Finanzen“):
 *   1. Tabelle(n) per Migration anlegen (+ RLS, + Realtime-Publication)
 *   2. Collection in lib/store/store.ts → COLLECTIONS ergänzen, Snapshot in lib/data/snapshot.ts laden
 *   3. Seite unter app/(app)/<route>/page.tsx anlegen
 *   4. Eintrag hier hinzufügen – Navigation und Einstellungen übernehmen ihn automatisch
 *   5. optional: Karte im Dashboard (components/dashboard/DashboardModules.tsx)
 */
export interface ModuleDef {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** in der unteren Navigation anzeigen */
  nav: boolean;
  description: string;
}

export const MODULES: ModuleDef[] = [
  { id: "heute", label: "Heute", href: "/", icon: Home, nav: true, description: "Briefing, Timeline, Fokus" },
  { id: "kalender", label: "Kalender", href: "/kalender", icon: CalendarDays, nav: true, description: "Heute, 7 Tage, Monat" },
  { id: "bereiche", label: "Bereiche", href: "/bereiche", icon: Layers3, nav: true, description: "Arbeit, Schule, Privat" },
  { id: "routinen", label: "Routinen", href: "/routinen", icon: Blocks, nav: true, description: "Habits & Streaks" },
  { id: "einkauf", label: "Einkauf", href: "/einkauf", icon: ShoppingBasket, nav: false, description: "Einkaufsliste" },
  { id: "einstellungen", label: "Einstellungen", href: "/einstellungen", icon: Settings2, nav: false, description: "Profil & Verbindungen" },
];

export const NAV_MODULES = MODULES.filter((m) => m.nav);
