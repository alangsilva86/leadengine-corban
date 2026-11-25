import { List, SearchX } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/page';
import LeadTable from '../components/table/LeadTable';
import useCrmLeads from '../hooks/useCrmLeads';
import { useCrmViewContext, useCrmViewState } from '../state/view-context';
import { countActiveFilters } from '../components/CrmToolbar';
import emitCrmTelemetry from '../utils/telemetry';

const LeadTableView = () => {
  const { filters } = useCrmViewState();
  const { openLeadDrawer } = useCrmViewContext();
  const { leads, total, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } = useCrmLeads(filters);

  const handleOpenDrawer = (leadId: string) => {
    openLeadDrawer(leadId);
    emitCrmTelemetry('crm.lead.open', { source: 'list', leadId });
  };

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <ErrorState title="Não foi possível carregar os leads" error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!isLoading && leads.length === 0) {
    const filtered = countActiveFilters(filters) > 0 || Boolean(filters.search);
    return (
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState
          icon={filtered ? SearchX : List}
          title={filtered ? 'Nenhum lead com esses filtros' : 'Nenhum lead no funil ainda'}
          description={
            filtered
              ? 'Ajuste a busca ou limpe os filtros para ver todos os leads.'
              : 'Os leads entram aqui quando um contato chega pelo WhatsApp ou por uma regra de roteamento.'
          }
        />
      </div>
    );
  }

  return (
    <LeadTable
      leads={leads}
      total={total}
      onOpenDrawer={handleOpenDrawer}
      fetchNextPage={() => void fetchNextPage()}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isLoading={isLoading}
    />
  );
};

export default LeadTableView;
