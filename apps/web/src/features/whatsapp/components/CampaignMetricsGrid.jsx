import { Skeleton } from '@/components/ui/skeleton.jsx';

import { formatNumber } from '../utils/campaign-helpers.js';

/** Grade compacta de métricas (leads, contactados…). */
const CampaignMetricsGrid = ({ metrics = [], loading = false, fallback = null }) => {
  const items = Array.isArray(metrics) ? metrics : [];

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: items.length || 3 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return fallback ? (
      <p className="rounded-lg bg-surface-sunken px-4 py-3 text-sm text-muted-foreground">{fallback}</p>
    ) : null;
  }

  return (
    <dl className="grid grid-cols-3 gap-3 rounded-lg bg-surface-sunken px-4 py-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">{item.label}</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">{formatNumber(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
};

export default CampaignMetricsGrid;
