import { getAnnualGoals } from "@/lib/goals";
import { AnnualGoalsCardBody } from "./AnnualGoalsCardBody";
import { SectionLoadError } from "./SectionLoadError";
import { WidgetCard } from "./WidgetCard";

export async function AnnualGoalsCard() {
  const goals = await getAnnualGoals();

  return (
    <WidgetCard title="Annual Goals" className="lg:col-span-3" id="annual-goals-section">
      {goals === null ? (
        <SectionLoadError message="Couldn't load your annual goals right now." />
      ) : (
        <AnnualGoalsCardBody goals={goals} />
      )}
    </WidgetCard>
  );
}
