import { getDailyGlanceData } from "@/lib/daily-glance";
import { DailyGlancePanel } from "./DailyGlancePanel";

export async function DailyGlance() {
  const data = await getDailyGlanceData();
  return <DailyGlancePanel data={data} />;
}
