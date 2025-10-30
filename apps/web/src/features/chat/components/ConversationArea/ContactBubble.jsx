import { Phone } from 'lucide-react';

const resolveContactName = (contact) =>
  contact?.name ?? contact?.fullName ?? contact?.displayName ?? contact?.formattedName ?? 'Contato';

const resolveContactPhones = (contact) => {
  if (Array.isArray(contact?.phones)) {
    return contact.phones;
  }
  if (typeof contact?.phone === 'string' && contact.phone.trim().length > 0) {
    return [contact.phone];
  }
  return [];
};

export const ContactBubble = ({ contacts = [], caption }) => (
  <div className="flex flex-col gap-2">
    {contacts.map((contact, index) => {
      const name = resolveContactName(contact);
      const phones = resolveContactPhones(contact);

      return (
        <div
          key={`${name}-${index}`}
          className="flex flex-col gap-1 rounded-lg bg-surface-overlay-quiet px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">{name}</span>
          </div>
          {phones.length > 0 ? (
            <ul className="ml-5 list-disc text-xs text-foreground-muted">
              {phones.map((phone, phoneIndex) => (
                <li key={`${name}-${phoneIndex}`}>{phone}</li>
              ))}
            </ul>
          ) : null}
          {contact?.org ? <span className="text-xs text-foreground-muted">{contact.org}</span> : null}
        </div>
      );
    })}
    {caption ? <p className="text-xs text-foreground-muted">{caption}</p> : null}
  </div>
);

export default ContactBubble;
