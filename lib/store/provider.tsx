"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { useStore } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { COLLECTIONS, createLifeStore, type LifeStore, type LifeStoreApi, type TableName } from "./store";
import type { ExternalCalendarState, SchoolState, Snapshot } from "@/lib/types";

const StoreContext = createContext<LifeStoreApi | null>(null);

/**
 * Stellt den globalen Store bereit:
 * 1. Hydration aus dem Server-Snapshot (eine Instanz pro Browser-Sitzung, nie zwischen Requests geteilt)
 * 2. Supabase Realtime → Änderungen von anderen Geräten landen sofort im Store
 * 3. Stundenplan aus dem School Hub wird im Hintergrund nachgeladen
 */
export function StoreProvider({ snapshot, children }: { snapshot: Snapshot; children: React.ReactNode }) {
  const storeRef = useRef<LifeStoreApi | null>(null);
  if (!storeRef.current) storeRef.current = createLifeStore(snapshot);
  const store = storeRef.current;

  // Neuer Server-Snapshot (z. B. nach router.refresh) → übernehmen
  useEffect(() => {
    if (store.getState().loadedAt !== snapshot.loadedAt) store.getState().hydrate(snapshot);
  }, [snapshot, store]);

  // Realtime-Sync
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`lifeos-${snapshot.userId}`);
    for (const table of Object.keys(COLLECTIONS) as TableName[]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (raw) => {
          const payload = raw as unknown as {
            eventType: "INSERT" | "UPDATE" | "DELETE";
            new: Record<string, unknown>;
            old: Record<string, unknown>;
          };
          const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as { id: string } & Record<string, unknown>;
          if (row?.id) store.getState().applyChange(table, payload.eventType, row);
        },
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [snapshot.userId, store]);

  // Stundenplan laden, sobald der Schalter an ist
  const showSchool = useStore(store, (s) => s.settings.show_school);
  useEffect(() => {
    let cancelled = false;
    if (!showSchool) {
      store.getState().setSchool({ state: "off" });
      return;
    }
    store.getState().setSchool({ state: "loading" });
    fetch("/api/school", { cache: "no-store" })
      .then((r) => r.json() as Promise<SchoolState>)
      .then((s) => !cancelled && store.getState().setSchool(s))
      .catch(() => !cancelled && store.getState().setSchool({ state: "error", message: "School Hub nicht erreichbar" }));
    return () => {
      cancelled = true;
    };
  }, [showSchool, store]);

  // Google Kalender & Co.: beim Start laden, beim Zurückkehren in die App auffrischen
  useEffect(() => {
    let last = 0;
    let running = false;
    const load = async () => {
      if (running) return;
      running = true;
      try {
        const r = await fetch("/api/calendar", { cache: "no-store" });
        if (r.ok) store.getState().setExternal((await r.json()) as ExternalCalendarState);
        last = Date.now();
      } catch {
        // offline: letzter Stand bleibt stehen
      } finally {
        running = false;
      }
    };
    load();
    const onVisible = () => document.visibilityState === "visible" && Date.now() - last > 5 * 60_000 && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [store]);

  // Life OS → Google Kalender: nach Änderungen an Terminen (gebündelt) und einmal beim Start abgleichen
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSig = "";
    let syncing = false;
    let again = false;
    const signature = (events: LifeStore["events"]) =>
      events
        .filter((e) => e.kind === "event")
        .map((e) => [e.id, e.title, e.starts_at, e.ends_at, e.all_day, e.location, e.description, e.google_uid ? 1 : 0].join("|"))
        .sort()
        .join("~");
    const run = async () => {
      if (syncing) {
        again = true;
        return;
      }
      syncing = true;
      try {
        const r = await fetch("/api/google/sync", { method: "POST", cache: "no-store" });
        const res = (await r.json()) as { pushed?: number; removed?: number };
        // neue Google-Termine gleich im Abo sichtbar machen (Dopplungen filtert der Server)
        if ((res.pushed ?? 0) + (res.removed ?? 0) > 0) {
          const ext = await fetch("/api/calendar?refresh=1", { cache: "no-store" });
          if (ext.ok) store.getState().setExternal((await ext.json()) as ExternalCalendarState);
        }
      } catch {
        // offline: beim nächsten Mal
      } finally {
        syncing = false;
        if (again) {
          again = false;
          schedule(1500);
        }
      }
    };
    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, ms);
    };
    lastSig = signature(store.getState().events);
    schedule(4000);
    const unsub = store.subscribe((state) => {
      const sig = signature(state.events);
      if (sig !== lastSig) {
        lastSig = sig;
        schedule(2500);
      }
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/**
 * Selector-Hook. Wichtig: Selektoren geben Rohdaten zurück (z. B. s.tasks),
 * abgeleitete Listen werden mit useMemo in der Komponente berechnet –
 * so gibt es keine unnötigen Re-Renders.
 */
export function useLife<T>(selector: (s: LifeStore) => T): T {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useLife muss innerhalb von <StoreProvider> verwendet werden");
  return useStore(store, selector);
}

/** Direkter Zugriff auf Aktionen ohne Re-Render-Abo. */
export function useLifeApi(): LifeStoreApi {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useLifeApi muss innerhalb von <StoreProvider> verwendet werden");
  return store;
}

/** Bequemer Zugriff auf alle Aktionen (stabile Referenzen). */
export function useActions() {
  return useLifeApi().getState();
}
