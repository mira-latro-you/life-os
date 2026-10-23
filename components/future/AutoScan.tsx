"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { scanFutureLog } from "@/app/actions/future";

/**
 * Hintergrund-Scan: stößt beim Öffnen der App unauffällig den Gemini-Scan an.
 * Der Server entscheidet selbst, ob er wirklich läuft (höchstens alle 12 Stunden),
 * hier wird nur verhindert, dass es pro Sitzung mehrfach angefragt wird.
 */
export function AutoScan() {
  const router = useRouter();

  useEffect(() => {
    try {
      if (sessionStorage.getItem("lifeos-autoscan")) return;
      sessionStorage.setItem("lifeos-autoscan", "1");
    } catch {
      /* privater Modus – trotzdem einmal versuchen */
    }
    const t = setTimeout(async () => {
      const r = await scanFutureLog(false).catch(() => null);
      if (r?.ok && (r.data?.created ?? 0) > 0) router.refresh();
    }, 1500);
    return () => clearTimeout(t);
  }, [router]);

  return null;
}
