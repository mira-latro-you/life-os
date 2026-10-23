import "server-only";
import type { NewsItem } from "./types";

const ENDPOINT = "https://www.tagesschau.de/api2u/homepage/";

interface TagesschauStory {
  sophoraId?: string;
  externalId?: string;
  title?: string;
  topline?: string;
  shareURL?: string;
  detailsweb?: string;
  date?: string;
  type?: string;
}

/**
 * Top-Schlagzeilen der Tagesschau.
 * Server-seitig gecacht (30 min) → max. 2 Abrufe/Stunde, weit unter dem Limit von 60/h.
 * Nutzung nur privat/nicht-kommerziell – passt für eine Single-User-App.
 */
export async function getHeadlines(limit = 5): Promise<NewsItem[]> {
  try {
    const res = await fetch(ENDPOINT, {
      next: { revalidate: 1800 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];

    const json = (await res.json()) as { news?: TagesschauStory[] };
    const seen = new Set<string>();

    return (json.news ?? [])
      .filter((s) => s.type === "story" && s.title && (s.shareURL || s.detailsweb))
      .filter((s) => {
        const key = s.title!;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit)
      .map((s, i) => ({
        id: s.sophoraId ?? s.externalId ?? String(i),
        title: s.title!,
        topline: s.topline ?? null,
        url: (s.shareURL ?? s.detailsweb)!,
        date: s.date ?? new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}
