"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { clearSchoolCache } from "@/lib/school-hub";

export async function setShowSchool(show: boolean) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, show_school: show }, { onConflict: "user_id" });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  return { ok: true as const };
}

export async function refreshSchool() {
  const { supabase, user } = await requireUser();
  await clearSchoolCache(supabase, user.id);
  revalidatePath("/");
  return { ok: true as const };
}
