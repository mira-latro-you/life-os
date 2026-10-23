"use server";

import { requireUser } from "@/lib/auth";
import { routeBrainDump, type RoutedItem } from "@/lib/gemini";

export interface RoutedResult {
  route: RoutedItem["route"];
  table: "events" | "tasks" | "shopping_items" | "notes";
  row: { id: string } & Record<string, unknown>;
  workspaceKey: string;
}

type Response = { ok: true; transcript: string | null; results: RoutedResult[] } | { ok: false; error: string };

const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

/**
 * AI Brain Dump: Text oder Sprachaufnahme → Gemini zerlegt & routet → Einträge werden
 * direkt in die passenden Tabellen geschrieben. Rückgabe enthält die angelegten Zeilen,
 * damit der Client sie sofort im Store hat und einzeln rückgängig machen kann.
 */
export async function brainDump(input: { text?: string; audio?: { mimeType: string; data: string } }): Promise<Response> {
  const { supabase, user } = await requireUser();

  const text = input.text?.trim().slice(0, 4000);
  if (!text && !input.audio) return { ok: false, error: "Leere Eingabe" };
  if (input.audio && input.audio.data.length * 0.75 > MAX_AUDIO_BYTES) return { ok: false, error: "Aufnahme zu lang" };

  const [{ data: workspaces }, { data: profile }, { data: projectRows }] = await Promise.all([
    supabase.from("workspaces").select("id, key, name, description").order("position"),
    supabase.from("profiles").select("display_name, school_class, employer, job_role").eq("user_id", user.id).maybeSingle(),
    supabase.from("tasks").select("project").not("project", "is", null).limit(300),
  ]);
  const ws = workspaces ?? [];
  const projects: string[] = [...new Set<string>((projectRows ?? []).map((r: { project: string | null }) => String(r.project ?? "")).filter(Boolean))].slice(0, 30);

  let routed: Awaited<ReturnType<typeof routeBrainDump>>;
  try {
    routed = await routeBrainDump(
      { text, audio: input.audio ? { mimeType: normalizeMime(input.audio.mimeType), data: input.audio.data } : undefined },
      { profile: profile ?? {}, workspaces: ws, projects },
    );
  } catch (err) {
    console.error("[brain-dump]", err);
    return { ok: false, error: "Gemini konnte das gerade nicht verarbeiten." };
  }
  if (routed.items.length === 0) return { ok: false, error: "Daraus konnte ich nichts ableiten – formulier es etwas konkreter." };

  const wsId = (key: string) => ws.find((w) => w.key === key)?.id ?? null;
  const results: RoutedResult[] = [];

  for (const it of routed.items) {
    let table: RoutedResult["table"];
    let payload: Record<string, unknown>;

    switch (it.route) {
      case "event":
        table = "events";
        payload = {
          kind: "event",
          title: it.title,
          starts_at: it.starts_at,
          ends_at: it.all_day ? null : it.ends_at,
          all_day: it.all_day,
          location: it.location,
          workspace_id: wsId(it.workspace),
          source: "ai",
          remind_at: !it.all_day && it.starts_at ? new Date(new Date(it.starts_at).getTime() - 30 * 60_000).toISOString() : null,
        };
        break;
      case "shopping":
        table = "shopping_items";
        payload = { title: it.title, quantity: it.quantity, store: it.store, project: it.project };
        break;
      case "note":
        table = "notes";
        payload = { title: it.title, content: it.content ?? it.title, workspace_id: wsId(it.workspace) };
        break;
      default:
        table = "tasks";
        payload = {
          title: it.title,
          type: it.task_type,
          project: it.project,
          due_at: it.due_at,
          workspace_id: wsId(it.workspace),
          source: "brain_dump",
        };
    }

    const { data, error } = await supabase.from(table).insert(payload).select("*").single();
    if (error || !data) {
      console.error("[brain-dump] insert", table, error);
      continue;
    }
    results.push({ route: it.route, table, row: data as RoutedResult["row"], workspaceKey: it.workspace });
  }

  await supabase.from("brain_dumps").insert({
    input: text ?? routed.transcript ?? "(Sprachaufnahme)",
    result: { transcript: routed.transcript, items: results.map((r) => ({ table: r.table, id: r.row.id })) },
  });

  if (results.length === 0) return { ok: false, error: "Speichern fehlgeschlagen." };
  return { ok: true, transcript: routed.transcript, results };
}

/** Browser-Aufnahmeformate auf von Gemini unterstützte MIME-Typen abbilden. */
function normalizeMime(mime: string) {
  const m = mime.split(";")[0].trim().toLowerCase();
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "audio/aac";
  if (m.includes("webm")) return "audio/webm";
  if (m.includes("ogg")) return "audio/ogg";
  if (m.includes("wav")) return "audio/wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "audio/mp3";
  return m || "audio/webm";
}
