import { getWorkoutSessions } from "@/lib/workouts";
import { WorkoutCard } from "./WorkoutCard";

// A thin async wrapper so Weight Training's own fetch can sit behind its own
// Suspense boundary in page.tsx, independent of every other card, without
// having to convert WorkoutCard itself (a Client Component) into one.
export async function WorkoutCardLoader() {
  const sessions = await getWorkoutSessions();
  return <WorkoutCard sessions={sessions} />;
}
