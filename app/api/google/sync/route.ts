import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { syncEventsToGoogle } from "@/lib/google-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** App-Termine in den Google Kalender übertragen (wird vom Client nach Änderungen angestoßen). */
export async function POST() {
  const { supabase, user } = await requireUser();
  return NextResponse.json(await syncEventsToGoogle(supabase, user.id));
}
