import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export const ContactDetailsCard = ({ contact }) => {
  if (!contact) {
    return null;
  }

  return (
    <Card className="border-slate-800/60 bg-slate-950/80 text-slate-200">
      <CardHeader>
        <CardTitle className="text-sm">Contato</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs">
        <div className="flex justify-between">
          <span>Telefone</span>
          <span>{contact.phone ?? '—'}</span>
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
