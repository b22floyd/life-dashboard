import { getContacts } from "@/lib/contacts";
import { ContactsCardBody } from "./ContactsCardBody";
import { SectionLoadError } from "./SectionLoadError";
import { WidgetCard } from "./WidgetCard";

export async function ContactsCard() {
  const contacts = await getContacts();

  return (
    <WidgetCard title="Contacts / Relationship Tracker" id="contacts-section">
      {contacts === null ? (
        <SectionLoadError message="Couldn't load your contacts right now." />
      ) : (
        <ContactsCardBody contacts={contacts} />
      )}
    </WidgetCard>
  );
}
