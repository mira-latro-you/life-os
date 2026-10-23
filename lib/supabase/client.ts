import { createBrowserClient } from "@supabase/ssr";

/** Supabase-Client für Client Components (läuft im Browser). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
