import { getContacts } from "@/lib/contacts";
import { ContactsCardBody } from "./ContactsCardBody";
import { WidgetCard } from "./WidgetCard";

export async function ContactsCard() {
  const contacts = await getContacts();

  return (
    <WidgetCard title="Contacts / Relationship Tracker">
      <ContactsCardBody contacts={contacts} />
    </WidgetCard>
  );
}
