import { forwardRef, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { cn } from '@/lib/utils.js';

import LeadAllocationCard from './LeadAllocationCard.jsx';
import EmptyInboxState from './EmptyInboxState.jsx';
import { InboxSurface } from './shared/InboxSurface.jsx';

const SkeletonCard = () => (
  <InboxSurface tone="strong" radius="24" padding="lg" shadow="none" className="space-y-4 text-[var(--color-inbox-foreground)] shadow-[0_18px_44px_color-mix(in_srgb,var(--color-inbox-border)_48%,transparent)] backdrop-blur-xl">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <div className="h-2.5 w-16 animate-pulse rounded-full bg-[color:var(--surface-overlay-quiet)]" />
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded-full bg-[color:var(--surface-overlay-quiet)]" />
          <div className="h-3 w-24 animate-pulse rounded-full bg-[color:var(--surface-overlay-quiet)]" />
        </div>
      </div>
      <div className="h-6 w-28 animate-pulse rounded-full bg-[color:var(--surface-overlay-quiet)]" />
    </div>

    <InboxSurface radius="md" padding="sm" shadow="none" className="grid gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, detailIndex) => (
        <div key={`allocation-detail-${detailIndex}`} className="space-y-2">
          <div className="h-2.5 w-24 animate-pulse rounded-full bg-[color:var(--surface-overlay-quiet)]" />
          <div className="h-3.5 w-28 animate-pulse rounded-full bg-[color:var(--surface-overlay-quiet)]" />
        </div>
      ))}
    </InboxSurface>

    <div className="grid gap-3 border-t border-[var(--color-inbox-border)] pt-4 sm:grid-cols-2">
      {Array.from({ length: 2 }).map((_, summaryIndex) => (
        <div key={`allocation-summary-${summaryIndex}`} className="space-y-2">
          <div className="h-2.5 w-24 animate-pulse rounded-full bg-[color:var(--surface-overlay-quiet)]" />
          <div className="h-4 w-32 animate-pulse rounded-full bg-[color:var(--surface-overlay-quiet)]" />
        </div>
      ))}
    </div>
  </InboxSurface>
);

const EmptyFilteredState = ({ className }) => (
  <InboxSurface
    tone="strong"
    radius="24"
    padding="xl"
    shadow="none"
    className={cn(
      'border-dashed text-center text-sm text-[var(--color-inbox-foreground-muted)] shadow-[0_18px_44px_color-mix(in_srgb,var(--color-inbox-border)_48%,transparent)]',
      className
    )}
  >
    Nenhum lead com o filtro selecionado.
  </InboxSurface>
);

export const InboxList = forwardRef(
  (
    {
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
      className,
      scrollParent,
    },
    virtuosoRef
  ) => {
    const renderAllocation = useCallback(
      (index) => {
        const allocation = filteredAllocations[index];
        if (!allocation) {
          return null;
        }

        const isLastItem = index === filteredAllocations.length - 1;

        return (
          <div style={{ marginBottom: isLastItem ? 0 : '0.75rem' }}>
            <LeadAllocationCard
              allocation={allocation}
              isActive={allocation.allocationId === activeAllocationId}
              onSelect={onSelectAllocation}
              onDoubleOpen={onOpenWhatsApp}
            />
          </div>
        );
      },
      [
        filteredAllocations,
        activeAllocationId,
        onSelectAllocation,
        onOpenWhatsApp,
      ]
    );

    if (loading) {
      return (
        <div className={cn('space-y-3', className)} aria-live="polite" aria-busy="true">
          <span className="sr-only">Carregando leads…</span>
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={`allocation-skeleton-${index}`} />
          ))}
        </div>
      );
    }

    if (allocations.length === 0) {
      return (
        <EmptyInboxState
          onBackToWhatsApp={onBackToWhatsApp}
          onSelectAgreement={onSelectAgreement}
        />
      );
    }

    if (filteredAllocations.length === 0) {
      return <EmptyFilteredState className={className} />;
    }

    return (
      <Virtuoso
        ref={virtuosoRef}
        className={className}
        style={scrollParent ? undefined : { height: '100%' }}
        totalCount={filteredAllocations.length}
        itemContent={renderAllocation}
        computeItemKey={(index) =>
          filteredAllocations[index]?.allocationId ?? index
        }
        defaultItemHeight={88}
        increaseViewportBy={{ top: 352, bottom: 352 }}
        customScrollParent={scrollParent ?? undefined}
      />
    );
  }
);

InboxList.displayName = 'InboxList';

export default InboxList;
