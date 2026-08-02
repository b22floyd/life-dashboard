import { WidgetCard } from "./WidgetCard";

const summary = [
  { id: 1, label: "Checking", amount: "$2,410.50" },
  { id: 2, label: "Savings", amount: "$8,120.00" },
  { id: 3, label: "This month's spending", amount: "$1,205.32" },
];

export function FinanceCard() {
  return (
    <WidgetCard title="Finance Snapshot">
      <ul className="flex flex-col gap-3">
        {summary.map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-zinc-700 dark:text-zinc-300">
              {row.label}
            </span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {row.amount}
            </span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
