import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSmartInput } from "@/lib/gemini";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < 2 || text.length > 500) {
    return NextResponse.json({ error: "Eingabe zu kurz oder zu lang" }, { status: 400 });
  }

  try {
    const parsed = await parseSmartInput(text);

    // Standard-Reminder: 30 min vorher (nur Termine mit Uhrzeit)
    const remind_at =
      parsed.kind === "event" && parsed.starts_at && !parsed.all_day
        ? new Date(new Date(parsed.starts_at).getTime() - 30 * 60_000).toISOString()
        : null;

    const { data, error } = await supabase
      .from("events")
      .insert({ ...parsed, remind_at, source: "ai" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch (err) {
    console.error("[smart-input]", err);
    return NextResponse.json(
      { error: "Konnte das nicht verstehen – formulier es etwas anders." },
      { status: 422 },
    );
  }
}
