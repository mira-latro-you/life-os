import { berlinHour, formatLongDate } from "@/lib/dates";

function salutation(hour: number) {
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Hallo";
  return "Guten Abend";
}

export function Greeting({ eventCount, todoCount }: { eventCount: number; todoCount: number }) {
  const name = process.env.NEXT_PUBLIC_OWNER_NAME;
  const now = new Date();

  const summary =
    eventCount === 0 && todoCount === 0
      ? "Nichts geplant – freier Kopf."
      : [
          eventCount > 0 && `${eventCount} ${eventCount === 1 ? "Termin" : "Termine"}`,
          todoCount > 0 && `${todoCount} offene ${todoCount === 1 ? "Aufgabe" : "Aufgaben"}`,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <header className="animate-rise px-1 pb-2 pt-2">
      <p className="text-sm capitalize text-ink-muted">{formatLongDate(now)}</p>
      <h1 className="mt-1 text-[2rem] font-semibold leading-tight tracking-tight">
        {salutation(berlinHour(now))}
        {name ? `, ${name}` : ""}
        <span className="text-glow-400">.</span>
      </h1>
      <p className="mt-1 text-sm text-ink-muted">{summary}</p>
    </header>
  );
}
