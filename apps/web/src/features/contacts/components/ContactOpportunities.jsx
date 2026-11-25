import { Link } from 'react-router-dom';
import { Briefcase, Plus } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/page';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { formatDateTime } from '@/features/crm/utils/labels';
import LeadStageBadge from '@/features/crm/components/lead-stage/LeadStageBadge';

/** Oportunidades (propostas de consignado) do contato. Criação e atualização ficam em /crm/opportunities. */
const ContactOpportunities = ({ contactId, items = [], isLoading = false, error = null, onRetry }) => {
  const href = `/crm/opportunities?${new URLSearchParams({ contactId })}`;

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState size="compact" title="Não foi possível carregar as oportunidades" error={error} onRetry={onRetry} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={Briefcase}
        title="Nenhuma oportunidade ainda"
        description="Registre a simulação de consignado para acompanhar convênio, produto e próxima ação."
        action={
          <Button asChild size="sm" variant="outline">
            <Link to={href}>
              <Plus aria-hidden="true" />
              Registrar oportunidade
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground tabular-nums">
          {items.length === 1 ? '1 oportunidade' : `${items.length} oportunidades`}
        </p>
        <Button asChild size="sm" variant="outline">
          <Link to={href}>Gerenciar oportunidades</Link>
        </Button>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-md border border-border bg-surface px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {item.agreementRef} · {item.productRef}
              </p>
              <LeadStageBadge stage={item.stage} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Próxima ação: {item.nextAction}
              {item.nextActionAt ? ` · ${formatDateTime(item.nextActionAt)}` : ''}
              {item.owner?.name ? ` · ${item.owner.name}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContactOpportunities;
