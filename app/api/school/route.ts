import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearSchoolCache, getSchoolState } from "@/lib/school-hub";

export const dynamic = "force-dynamic";

/** Stundenplan aus dem School Hub (mit 30-Minuten-Cache). ?refresh=1 lädt neu. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ state: "error", message: "unauthorized" }, { status: 401 });

  if (new URL(request.url).searchParams.get("refresh")) await clearSchoolCache(supabase, user.id);
  const state = await getSchoolState(supabase, user.id, true);
  return NextResponse.json(state);
}
