import { Skeleton } from '@/components/ui/skeleton.jsx';

import { formatNumber } from '../utils/campaign-helpers.js';

const CampaignMetricsGrid = ({ metrics = [], loading = false, fallback = null }) => {
  const items = Array.isArray(metrics) ? metrics : [];
  const hasItems = items.length > 0;

  if (loading) {
    const skeletonCount = hasItems ? items.length : 4;
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!hasItems) {
    if (!fallback) {
      return null;
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4 rounded-lg border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-4 text-sm text-muted-foreground">
          {fallback}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-3 text-center">
          <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{formatNumber(item.value)}</p>
        </div>
      ))}
    </div>
  );
};

export default CampaignMetricsGrid;
