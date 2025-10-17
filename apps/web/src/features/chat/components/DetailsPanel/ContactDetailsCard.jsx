import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { formatPhoneNumber } from '@/lib/utils.js';

export const ContactDetailsCard = ({ contact }) => {
  if (!contact) {
    return null;
  }

  return (
    <Card className="border-0 bg-surface-overlay-quiet text-foreground shadow-[0_24px_45px_-32px_rgba(15,23,42,0.9)] ring-1 ring-surface-overlay-glass-border backdrop-blur">
      <CardHeader>
        <CardTitle className="text-sm">Contato</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs text-foreground-muted">
        <div className="flex justify-between">
          <span>Telefone</span>
          <span>{formatPhoneNumber(contact.phone)}</span>
        </div>
        <div className="flex justify-between">
          <span>Email</span>
          <span>{contact.email ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span>Documento</span>
          <span>{contact.document ?? '—'}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactDetailsCard;
