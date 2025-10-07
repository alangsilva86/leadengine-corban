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
      <div className="space-y-2.5" aria-live="polite" aria-busy="true">
        <span className="sr-only">Carregando leads…</span>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`allocation-skeleton-${index}`}
            className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-2.5 w-16 animate-pulse rounded-full bg-white/10" />
                <div className="space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded-full bg-white/10" />
                  <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
                </div>
              </div>
              <div className="h-6 w-28 animate-pulse rounded-full bg-white/10" />
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, detailIndex) => (
                <div key={`allocation-detail-${detailIndex}`} className="space-y-2">
                  <div className="h-2.5 w-24 animate-pulse rounded-full bg-white/10" />
                  <div className="h-3.5 w-28 animate-pulse rounded-full bg-white/10" />
                </div>
              ))}
            </div>

            <div className="grid gap-2.5 border-t border-white/5 pt-3 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, summaryIndex) => (
                <div key={`allocation-summary-${summaryIndex}`} className="space-y-2">
                  <div className="h-2.5 w-24 animate-pulse rounded-full bg-white/10" />
                  <div className="h-4 w-32 animate-pulse rounded-full bg-white/10" />
                </div>
              ))}
            </div>
          </div>
        ))}
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
    <div className="space-y-2.5">
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
