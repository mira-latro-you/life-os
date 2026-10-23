import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserSettings } from "@/lib/types";

/** Einstellungen lesen – legt beim ersten Aufruf die Zeile mit Standardwerten an. */
export async function getSettings(supabase: SupabaseClient, userId: string): Promise<UserSettings> {
  const { data } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as UserSettings;

  const { data: created } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select()
    .single();
  return (created as UserSettings) ?? { user_id: userId, show_school: false, last_future_scan: null };
}
