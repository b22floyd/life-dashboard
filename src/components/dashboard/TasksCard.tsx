import { WidgetCard } from "./WidgetCard";

const tasks = [
  { id: 1, label: "Review weekly budget", done: false },
  { id: 2, label: "Book dentist appointment", done: false },
  { id: 3, label: "Renew car insurance", done: true },
];

export function TasksCard() {
  return (
    <WidgetCard title="Today's Tasks">
      <ul className="flex flex-col gap-3">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-3">
            <input
              type="checkbox"
              defaultChecked={task.done}
              readOnly
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-700"
            />
            <span
              className={
                task.done
                  ? "text-sm text-zinc-400 line-through dark:text-zinc-600"
                  : "text-sm text-zinc-700 dark:text-zinc-300"
              }
            >
              {task.label}
            </span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
