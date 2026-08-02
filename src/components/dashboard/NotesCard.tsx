import { WidgetCard } from "./WidgetCard";

const notes = [
  "Ask Mom about Thanksgiving plans",
  "Idea: weekend trip to the coast",
  "Passport expires in March — renew soon",
];

export function NotesCard() {
  return (
    <WidgetCard title="Notes">
      <ul className="flex flex-col gap-3">
        {notes.map((note) => (
          <li
            key={note}
            className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
          >
            {note}
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
