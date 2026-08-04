import { getJournalEntries } from "@/lib/journal";
import { JournalCard } from "./JournalCard";

// A thin async wrapper so Journal's own fetch can sit behind its own
// Suspense boundary in page.tsx, independent of every other card, without
// having to convert JournalCard itself (a Client Component) into one.
export async function JournalCardLoader() {
  const entries = await getJournalEntries();
  return <JournalCard entries={entries} />;
}
