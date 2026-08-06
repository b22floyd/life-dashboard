import { pickPhrase } from "@/lib/splash";
import { SplashScreen } from "@/components/SplashScreen";

// Next's route-level Suspense fallback for this segment — a backstop for
// whenever this specific boundary is what's pending (e.g. JS disabled or
// still hydrating). In normal operation, AppSplashOverlay in the root
// layout is what actually guarantees the splash shows on every real app
// open (see its own comment for why this one alone couldn't do that).
export default function Loading() {
  return <SplashScreen phrase={pickPhrase()} />;
}
