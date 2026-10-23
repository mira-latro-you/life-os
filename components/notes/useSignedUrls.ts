"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const cache = new Map<string, { url: string; exp: number }>();

/** Signierte URLs für private Storage-Bilder (1 h gültig, im Speicher gecacht). */
export function useSignedUrls(paths: string[]) {
  const key = paths.join("|");
  const [urls, setUrls] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of paths) {
      const c = cache.get(p);
      if (c && c.exp > Date.now()) out[p] = c.url;
    }
    return out;
  });

  useEffect(() => {
    const missing = paths.filter((p) => {
      const c = cache.get(p);
      return !c || c.exp < Date.now();
    });
    if (missing.length === 0) return;
    let cancelled = false;
    createClient()
      .storage.from("note-images")
      .createSignedUrls(missing, 3600)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next: Record<string, string> = {};
        for (const d of data) {
          if (d.signedUrl && d.path) {
            cache.set(d.path, { url: d.signedUrl, exp: Date.now() + 3_300_000 });
            next[d.path] = d.signedUrl;
          }
        }
        setUrls((u) => ({ ...u, ...next }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}
