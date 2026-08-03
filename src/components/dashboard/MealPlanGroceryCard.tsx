import { getGroceryItems, getGroceryStaples } from "@/lib/grocery";
import { getMealPlan } from "@/lib/meal-plan";
import { GroceryListSection } from "./GroceryListSection";
import { MealPlanSection } from "./MealPlanSection";
import { WidgetCard } from "./WidgetCard";

export async function MealPlanGroceryCard() {
  const [mealPlan, groceryItems, groceryStaples] = await Promise.all([
    getMealPlan(),
    getGroceryItems(),
    getGroceryStaples(),
  ]);

  return (
    <WidgetCard title="Meal Planning & Grocery List" className="lg:col-span-3">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MealPlanSection entries={mealPlan} />
        <GroceryListSection items={groceryItems} staples={groceryStaples} />
      </div>
    </WidgetCard>
  );
}
