import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildDataExport } from "@/lib/export";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in to export your data." }, { status: 401 });
  }

  let data;
  try {
    data = await buildDataExport(supabase, user.id);
  } catch (error) {
    console.error("Data export failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to build data export." }, { status: 500 });
  }

  const filename = `life-dashboard-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
