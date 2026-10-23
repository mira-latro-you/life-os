"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError("Anmeldung fehlgeschlagen.");
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  const field =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[16px] text-ink placeholder:text-ink-faint transition-colors focus:border-glow-400/50 focus:outline-none";

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <form onSubmit={signIn} className="glass-strong w-full max-w-sm animate-rise rounded-3xl p-7">
        <div className="mb-6 grid size-11 place-items-center rounded-2xl bg-glow-400/15 text-glow-300">
          <Lock className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Life OS</h1>
        <p className="mb-6 mt-1 text-sm text-ink-muted">Privater Zugang.</p>

        <div className="flex flex-col gap-3">
          <input type="email" autoComplete="email" placeholder="E-Mail" required value={email}
            onChange={(e) => setEmail(e.target.value)} className={field} />
          <input type="password" autoComplete="current-password" placeholder="Passwort" required value={password}
            onChange={(e) => setPassword(e.target.value)} className={field} />
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-glow-400 py-3 font-medium text-abyss-950 transition-all duration-300 hover:bg-glow-300 active:scale-[0.98] disabled:opacity-60"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          Anmelden
        </button>
      </form>
    </main>
  );
}
