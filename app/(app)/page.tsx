import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { BriefingCard, BriefingSkeleton } from "@/components/briefing/BriefingCard";

export const maxDuration = 60;

/** Homescreen – das Briefing wird serverseitig erzeugt und nachgestreamt, alles andere kommt sofort aus dem Store. */
export default function HomePage() {
  return (
    <Dashboard
      briefing={
        <Suspense fallback={<BriefingSkeleton />}>
          <BriefingCard />
        </Suspense>
      }
    />
  );
}
