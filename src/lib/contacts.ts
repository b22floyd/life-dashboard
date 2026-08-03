import { createClient } from "@/lib/supabase/server";
import {
  computeContactStatus,
  type Contact,
  type ContactCategory,
  type ContactWithStatus,
} from "@/lib/contacts-utils";

type ContactRow = {
  id: string;
  name: string;
  category: ContactCategory;
  birthday: string | null;
  important_date: string | null;
  important_date_label: string;
  notes: string;
  gift_ideas: string;
  cadence_days: number;
  created_at: string;
  contact_log: { contacted_at: string }[] | null;
};

export async function getContacts(): Promise<ContactWithStatus[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      `id, name, category, birthday, important_date, important_date_label, notes, gift_ideas, cadence_days, created_at,
       contact_log (contacted_at)`,
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load contacts:", error.message);
    return [];
  }

  const now = new Date();
  return ((data ?? []) as ContactRow[]).map((row) => {
    const logs = row.contact_log ?? [];
    const lastContactedAt =
      logs.length === 0
        ? null
        : logs.reduce((latest, log) =>
            new Date(log.contacted_at).getTime() > new Date(latest).getTime()
              ? log.contacted_at
              : latest,
          logs[0].contacted_at);

    const contact: Contact = {
      id: row.id,
      name: row.name,
      category: row.category,
      birthday: row.birthday,
      importantDate: row.important_date,
      importantDateLabel: row.important_date_label,
      notes: row.notes,
      giftIdeas: row.gift_ideas,
      cadenceDays: row.cadence_days,
      createdAt: row.created_at,
    };

    return computeContactStatus(contact, lastContactedAt, now);
  });
}
