import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';

const ContactSummary = ({ contact }) => {
  if (!contact) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Selecione um contato para visualizar o resumo.</CardContent>
      </Card>
    );
  }

  const tags = Array.isArray(contact.tags) ? contact.tags : [];
  const customFields = contact.customFields && typeof contact.customFields === 'object' ? contact.customFields : {};

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Informações principais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="block text-xs font-medium uppercase text-muted-foreground">Nome</span>
            <span className="text-base font-semibold">{contact.name ?? 'Contato sem nome'}</span>
          </div>
          <div>
            <span className="block text-xs font-medium uppercase text-muted-foreground">Telefone</span>
            <span>{contact.phone ?? '—'}</span>
          </div>
          <div>
            <span className="block text-xs font-medium uppercase text-muted-foreground">E-mail</span>
            <span>{contact.email ?? '—'}</span>
          </div>
          <div>
            <span className="block text-xs font-medium uppercase text-muted-foreground">Documento</span>
            <span>{contact.document ?? '—'}</span>
          </div>
          <div>
            <span className="block text-xs font-medium uppercase text-muted-foreground">Tags</span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {tags.length === 0 ? <Badge variant="outline">Sem tags</Badge> : null}
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Campos personalizados</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(customFields).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum campo personalizado preenchido.</p>
          ) : (
            <dl className="space-y-3 text-sm">
              {Object.entries(customFields).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">{key}</dt>
                  <dd>{String(value)}</dd>
                  <Separator className="my-2" />
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContactSummary;
