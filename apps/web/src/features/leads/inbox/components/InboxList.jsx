import { Loader2 } from 'lucide-react';

import LeadAllocationCard from './LeadAllocationCard.jsx';
import EmptyInboxState from './EmptyInboxState.jsx';

export const InboxList = ({
  allocations,
  filteredAllocations,
  loading,
  selectedAgreement,
  campaign,
  onBackToWhatsApp,
  onSelectAgreement,
  onSelectAllocation,
  activeAllocationId,
  onOpenWhatsApp,
}) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-6 text-center text-sm text-muted-foreground/80">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/70" />
        <p className="text-sm font-medium text-foreground/80">Carregando leads…</p>
        <p className="text-xs text-muted-foreground/70">Estamos sincronizando com o WhatsApp conectado.</p>
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
          isActive={allocation.allocationId === activeAllocationId}
          onSelect={onSelectAllocation}
          onDoubleOpen={onOpenWhatsApp}
        />
      ))}
    </div>
  );
};

export default InboxList;
