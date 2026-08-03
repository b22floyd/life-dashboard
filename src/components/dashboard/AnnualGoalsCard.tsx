import { getAnnualGoals } from "@/lib/goals";
import { AnnualGoalsCardBody } from "./AnnualGoalsCardBody";
import { WidgetCard } from "./WidgetCard";

export async function AnnualGoalsCard() {
  const goals = await getAnnualGoals();

  return (
    <WidgetCard title="Annual Goals" className="lg:col-span-3">
      <AnnualGoalsCardBody goals={goals} />
    </WidgetCard>
  );
}
