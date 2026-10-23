import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyHeadlines } from "./gemini";
import type { NewsCategory, NewsItem } from "./types";

/**
 * News-Aggregator: freie RSS-Feeds + Tagesschau-API, Gemini ordnet jede Schlagzeile
 * einer Kategorie zu und markiert gute Nachrichten.
 * (NewsAPI.org ist im Gratis-Plan nur für Entwicklung erlaubt – deshalb RSS.)
 * Ergebnis wird 45 Minuten pro Nutzer in external_cache gehalten.
 */

interface Feed {
  source: string;
  url: string;
  hint: NewsCategory;
  type: "rss" | "tagesschau";
}

const FEEDS: Feed[] = [
  { source: "t3n E-Commerce", url: "https://t3n.de/tag/e-commerce/rss.xml", hint: "ecommerce", type: "rss" },
  { source: "t3n", url: "https://t3n.de/rss.xml", hint: "tech", type: "rss" },
  { source: "heise", url: "https://www.heise.de/rss/heise-atom.xml", hint: "tech", type: "rss" },
  { source: "Golem", url: "https://rss.golem.de/rss.php?feed=RSS2.0", hint: "tech", type: "rss" },
  { source: "The Decoder", url: "https://the-decoder.de/feed/", hint: "ki", type: "rss" },
  { source: "tagesschau", url: "https://www.tagesschau.de/api2u/news/?ressort=wirtschaft", hint: "wirtschaft", type: "tagesschau" },
  { source: "tagesschau", url: "https://www.tagesschau.de/api2u/homepage/", hint: "allgemein", type: "tagesschau" },
];

const CACHE_KEY = "news_v1";
const TTL_MS = 45 * 60_000;
const PER_FEED = 12;

/* ── Parsing ─────────────────────────────────────────────────────── */

function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const tag = (block: string, name: string) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m ? decode(m[1]) : "";
};

function parseFeed(xml: string, feed: Feed): Omit<NewsItem, "id" | "category" | "positive">[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return blocks.slice(0, PER_FEED * 2).flatMap((b) => {
    const title = tag(b, "title");
    let url = tag(b, "link");
    if (!url) url = /<link[^>]*href="([^"]+)"/i.exec(b)?.[1] ?? "";
    const date = tag(b, "pubDate") || tag(b, "dc:date") || tag(b, "published") || tag(b, "updated");
    if (!title || !url || /^anzeige:/i.test(title)) return [];
    const published = date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : new Date().toISOString();
    return [{ title, url: url.trim(), source: feed.source, published }];
  });
}

async function fetchFeed(feed: Feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "LifeOS/1.0 (private RSS reader)", Accept: "application/rss+xml, application/atom+xml, application/json, text/xml" },
      signal: AbortSignal.timeout(7_000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    if (feed.type === "tagesschau") {
      const json = (await res.json()) as { news?: { title?: string; shareURL?: string; detailsweb?: string; date?: string; type?: string }[] };
      return (json.news ?? [])
        .filter((n) => n.type === "story" && n.title && (n.shareURL || n.detailsweb))
        .slice(0, PER_FEED)
        .map((n) => ({ title: n.title!, url: (n.shareURL ?? n.detailsweb)!, source: feed.source, published: n.date ?? new Date().toISOString(), hint: feed.hint }));
    }
    return parseFeed(await res.text(), feed)
      .slice(0, PER_FEED)
      .map((n) => ({ ...n, hint: feed.hint }));
  } catch {
    return [];
  }
}

/* ── Aggregation + Klassifizierung ───────────────────────────────── */

async function buildNews(): Promise<NewsItem[]> {
  const raw = (await Promise.all(FEEDS.map(fetchFeed))).flat();

  // Duplikate (gleicher Titel/URL) entfernen, neueste zuerst
  const seen = new Set<string>();
  const unique = raw
    .sort((a, b) => b.published.localeCompare(a.published))
    .filter((n) => {
      const key = n.title.toLowerCase().slice(0, 60);
      if (seen.has(key) || seen.has(n.url)) return false;
      seen.add(key);
      seen.add(n.url);
      return true;
    })
    .slice(0, 70);

  let labels = new Map<number, { category: string; positive: boolean }>();
  try {
    const out = await classifyHeadlines(unique.map((n, i) => ({ i, title: n.title, source: n.source })));
    labels = new Map(out.items.map((x) => [x.i, x]));
  } catch (err) {
    console.error("[news] Klassifizierung fehlgeschlagen – nutze Feed-Kategorie", err);
  }

  const valid: NewsCategory[] = ["tech", "ki", "ecommerce", "wirtschaft", "allgemein"];
  return unique.map((n, i) => {
    const l = labels.get(i);
    const category = l && valid.includes(l.category as NewsCategory) ? (l.category as NewsCategory) : n.hint;
    return {
      id: `${i}-${n.url}`.slice(0, 200),
      title: n.title,
      url: n.url,
      source: n.source,
      published: n.published,
      category,
      positive: Boolean(l?.positive),
    };
  });
}

export async function getNews(supabase: SupabaseClient, userId: string, force = false): Promise<NewsItem[]> {
  if (!force) {
    const { data } = await supabase
      .from("external_cache")
      .select("payload, fetched_at")
      .eq("user_id", userId)
      .eq("key", CACHE_KEY)
      .maybeSingle();
    if (data && Date.now() - new Date(data.fetched_at).getTime() < TTL_MS) return data.payload as NewsItem[];
  }
  const items = await buildNews();
  if (items.length > 0) {
    await supabase.from("external_cache").upsert({ user_id: userId, key: CACHE_KEY, payload: items, fetched_at: new Date().toISOString() });
  }
  return items;
}
