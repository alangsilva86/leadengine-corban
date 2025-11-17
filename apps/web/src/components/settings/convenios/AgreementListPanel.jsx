import { CardContent } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import ConvenioList from './list/ConvenioList.jsx';
import { getErrorMessage } from '@/features/agreements/convenioSettings.utils.ts';

const AgreementListPanel = ({ error, onRetry, ...listProps }) => (
  <CardContent className="space-y-6">
    {error ? (
      <div className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <span>{getErrorMessage(error, 'Falha ao carregar convênios')}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    ) : null}
    <ConvenioList {...listProps} />
    <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Governança</p>
      <p>
        Gestores editam diretamente. Coordenadores podem exigir aprovação antes de publicar. Vendedores enxergam tudo e usam nas simulações, mas não mexem nas tabelas.
      </p>
    </div>
  </CardContent>
);

export default AgreementListPanel;
