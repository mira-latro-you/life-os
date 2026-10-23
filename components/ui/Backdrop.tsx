const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** Fixierter Hintergrund: tiefes Dunkelblau + zwei weich driftende Lichtflecken. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, var(--color-abyss-800) 0%, var(--color-abyss-900) 45%, var(--color-abyss-950) 100%)",
        }}
      />
      <div className="absolute -left-[20%] -top-[10%] h-[60vh] w-[80vw] rounded-full bg-[#1d4fd8]/30 blur-[110px] animate-drift" />
      <div className="absolute -bottom-[15%] -right-[25%] h-[55vh] w-[75vw] rounded-full bg-[#5b3fd6]/20 blur-[120px] animate-drift [animation-delay:-11s]" />
      {/* feines Rauschen gegen Farbbanding */}
      <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay" style={{ backgroundImage: NOISE }} />
    </div>
  );
}
