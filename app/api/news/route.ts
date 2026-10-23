import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getNews } from "@/lib/news";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

/** Aggregierte, klassifizierte News (45 Minuten Cache). ?refresh=1 erzwingt Neuladen. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const force = Boolean(new URL(request.url).searchParams.get("refresh"));
  const items = await getNews(supabase, user.id, force);
  return NextResponse.json({ items });
}
