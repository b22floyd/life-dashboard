import { WidgetCard } from "./WidgetCard";

const habits = [
  { id: 1, label: "Drink water", streak: 12 },
  { id: 2, label: "Exercise", streak: 4 },
  { id: 3, label: "Read", streak: 21 },
];

export function HabitsCard() {
  return (
    <WidgetCard title="Habit Streaks">
      <ul className="flex max-h-60 flex-col gap-3 overflow-y-auto">
        {habits.map((habit) => (
          <li
            key={habit.id}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-zinc-700 dark:text-zinc-300">
              {habit.label}
            </span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              🔥 {habit.streak} days
            </span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
