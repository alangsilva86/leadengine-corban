import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

const ContactDataView = ({ contact }) => (
  <Card>
    <CardHeader>
      <CardTitle>Dados completos</CardTitle>
    </CardHeader>
    <CardContent>
      {contact ? (
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground">
          {JSON.stringify(contact, null, 2)}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">Selecione um contato para visualizar os dados brutos.</p>
      )}
    </CardContent>
  </Card>
);

export default ContactDataView;
