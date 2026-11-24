import { useMemo } from 'react';
import LeadTable from '../components/table/LeadTable';
import useCrmLeads from '../hooks/useCrmLeads';
import { useCrmViewContext, useCrmViewState } from '../state/view-context';
import useCrmPermissions from '../state/permissions';
import emitCrmTelemetry from '../utils/telemetry';

const LeadTableView = () => {
  const { filters, selection } = useCrmViewState();
  const { selectIds, deselectIds, clearSelection, openLeadDrawer } = useCrmViewContext();
  const permissions = useCrmPermissions();
  const { leads, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } = useCrmLeads(filters);

  const selectedIds = useMemo(() => selection.selectedIds, [selection.selectedIds]);

  const handleToggleSelect = (leadId: string) => {
    if (!permissions.canMoveLead) {
      return;
    }
    if (selectedIds.has(leadId)) {
      deselectIds([leadId]);
    } else {
      selectIds([leadId]);
    }
  };

  const handleOpenDrawer = (leadId: string) => {
    clearSelection();
    selectIds([leadId]);
    openLeadDrawer(leadId);
    emitCrmTelemetry('crm.lead.open', { source: 'list', leadId });
  };

  if (error) return <p role="alert">Não foi possível carregar os leads. <button onClick={() => refetch()}>Tentar novamente</button></p>;

  return (
    <LeadTable
      leads={leads}
      selectedIds={selectedIds}
      onToggleSelect={handleToggleSelect}
      onOpenDrawer={handleOpenDrawer}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isLoading={isLoading}
      selectable={permissions.canMoveLead}
    />
  );
};

export default LeadTableView;
