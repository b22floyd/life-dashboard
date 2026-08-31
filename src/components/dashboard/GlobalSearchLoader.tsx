import { getSearchIndex } from "@/lib/search-index";
import { GlobalSearch } from "./GlobalSearch";

// A thin async Server Component wrapper, same pattern as WeatherWidgetLoader
// and DailyGlance — lets the index fetch sit behind its own Suspense
// boundary in Header.tsx, independent of the rest of the header.
export async function GlobalSearchLoader() {
  const items = await getSearchIndex();
  return <GlobalSearch items={items} />;
}
