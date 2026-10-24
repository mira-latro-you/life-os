import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { getExternalCalendar } from "@/lib/calendar-feeds";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Termine aus abonnierten Kalendern (Google Kalender etc.). ?refresh=1 umgeht den Cache. */
export async function GET(req: NextRequest) {
  const { supabase, user } = await requireUser();
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  return NextResponse.json(await getExternalCalendar(supabase, user.id, force));
}
