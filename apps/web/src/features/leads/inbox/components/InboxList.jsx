import { Loader2 } from 'lucide-react';

import LeadAllocationCard from './LeadAllocationCard.jsx';
import EmptyInboxState from './EmptyInboxState.jsx';

export const InboxList = ({
  allocations,
  filteredAllocations,
  loading,
  selectedAgreement,
  campaign,
  onOpenWhatsApp,
  onUpdateStatus,
  onBackToWhatsApp,
  onSelectAgreement,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando leads...
      </div>
    );
  }

  if (allocations.length === 0) {
    return (
      <EmptyInboxState
        agreement={selectedAgreement}
        campaign={campaign}
        onBackToWhatsApp={onBackToWhatsApp}
        onSelectAgreement={onSelectAgreement}
      />
    );
  }

  if (filteredAllocations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-muted-foreground">
        Nenhum lead com o filtro selecionado.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredAllocations.map((allocation) => (
        <LeadAllocationCard
          key={allocation.allocationId}
          allocation={allocation}
          onOpenWhatsApp={onOpenWhatsApp}
          onUpdateStatus={onUpdateStatus}
        />
      ))}
    </div>
  );
};

export default InboxList;
