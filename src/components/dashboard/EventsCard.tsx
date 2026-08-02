import { WidgetCard } from "./WidgetCard";

const events = [
  { id: 1, time: "9:00 AM", label: "Team standup" },
  { id: 2, time: "12:30 PM", label: "Lunch with Sam" },
  { id: 3, time: "5:00 PM", label: "Gym" },
];

export function EventsCard() {
  return (
    <WidgetCard title="Upcoming Events">
      <ul className="flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id} className="flex gap-3 text-sm">
            <span className="w-20 shrink-0 font-medium text-zinc-500 dark:text-zinc-400">
              {event.time}
            </span>
            <span className="text-zinc-700 dark:text-zinc-300">
              {event.label}
            </span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
