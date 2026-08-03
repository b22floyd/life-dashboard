import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDataExport } from "@/lib/export";

const BACKUP_BUCKET = "backups";
// Keep roughly the last two months of weekly backups rather than
// accumulating forever.
const MAX_BACKUPS = 8;

export async function GET(request: Request) {
  // Vercel attaches this header automatically when invoking a Cron Job, as
  // long as the CRON_SECRET environment variable is set on the project —
  // this is what actually authorizes the request, since the route sits
  // outside the cookie-based auth gate (see proxy/middleware's isCronRoute
  // exclusion) and has no user session to check.
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Single-user dashboard — same assumption the habits seed migration and
  // the original journal_entries user-scoping migration both make.
  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers();
  const user = usersPage?.users[0];
  if (usersError || !user) {
    return NextResponse.json(
      { error: usersError?.message ?? "No user found to back up." },
      { status: 500 },
    );
  }

  let data;
  try {
    data = await buildDataExport(supabase, user.id);
  } catch (error) {
    console.error("Weekly backup export failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to build data export." }, { status: 500 });
  }

  const timestamp = new Date().toISOString();
  const filePath = `${timestamp.replace(/[:.]/g, "-")}.json`;

  const { error: uploadError } = await supabase.storage
    .from(BACKUP_BUCKET)
    .upload(filePath, JSON.stringify(data, null, 2), {
      contentType: "application/json",
      upsert: false,
    });

  if (uploadError) {
    console.error("Weekly backup upload failed:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Prune down to the most recent MAX_BACKUPS files. Filenames are ISO
  // timestamps with colons/periods swapped for dashes, so lexicographic
  // order matches chronological order.
  const { data: files, error: listError } = await supabase.storage
    .from(BACKUP_BUCKET)
    .list(undefined, { limit: 1000 });

  if (listError) {
    console.error("Weekly backup cleanup failed to list files:", listError.message);
  } else if (files) {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
    const toDelete = sorted.slice(0, Math.max(0, sorted.length - MAX_BACKUPS)).map((f) => f.name);
    if (toDelete.length > 0) {
      const { error: removeError } = await supabase.storage.from(BACKUP_BUCKET).remove(toDelete);
      if (removeError) {
        console.error("Weekly backup cleanup failed to remove old files:", removeError.message);
      }
    }
  }

  return NextResponse.json({ success: true, file: filePath });
}
