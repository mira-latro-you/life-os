"use client";

import { useEffect } from "react";
import { scanBacklog } from "@/app/actions/ai";

/**
 * Hintergrund-Planung: stößt beim Öffnen der App den Gemini-Scan für Aufgaben ohne Datum an.
 * Der Server läuft höchstens alle 12 Stunden; neue Vorschläge kommen per Realtime in den Store.
 */
export function AutoScan() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("lifeos-autoscan")) return;
      sessionStorage.setItem("lifeos-autoscan", "1");
    } catch {
      /* privater Modus */
    }
    const t = setTimeout(() => scanBacklog(false).catch(() => null), 2500);
    return () => clearTimeout(t);
  }, []);
  return null;
}
