import { getLocalDateString } from "@/lib/date-utils";
import { getGroceryItems, getGroceryStaples } from "@/lib/grocery";
import { getMealPlanForWeek } from "@/lib/meal-plan";
import { getWeekStartDate } from "@/lib/meal-plan-utils";
import { GroceryListSection } from "./GroceryListSection";
import { MealPlanSection } from "./MealPlanSection";
import { WidgetCard } from "./WidgetCard";

export async function MealPlanGroceryCard() {
  // The server's clock is effectively UTC (see Timezones in the README), so
  // this is only a best-effort guess at "this week" — MealPlanSection
  // corrects it client-side against the browser's real local date on mount.
  const initialWeekStartDate = getWeekStartDate(getLocalDateString());

  const [initialEntries, groceryItems, groceryStaples] = await Promise.all([
    getMealPlanForWeek(initialWeekStartDate),
    getGroceryItems(),
    getGroceryStaples(),
  ]);

  return (
    <WidgetCard title="Meal Planning & Grocery List" className="lg:col-span-3">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MealPlanSection
          initialWeekStartDate={initialWeekStartDate}
          initialEntries={initialEntries}
        />
        <GroceryListSection items={groceryItems} staples={groceryStaples} />
      </div>
    </WidgetCard>
  );
}
