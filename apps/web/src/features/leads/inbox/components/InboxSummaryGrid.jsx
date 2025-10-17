import { MessageSquare, Trophy, XCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils.js';

export const statusMetrics = [
  { key: 'total', label: 'Total recebido' },
  {
    key: 'contacted',
    label: 'Em conversa',
    accent: 'text-status-whatsapp',
    icon: <MessageSquare className="h-4 w-4 text-status-whatsapp" />,
  },
  { key: 'won', label: 'Ganhos', accent: 'text-success', icon: <Trophy className="h-4 w-4 text-success" /> },
  { key: 'lost', label: 'Perdidos', accent: 'text-status-error', icon: <XCircle className="h-4 w-4 text-status-error" /> },
];

export const formatSummaryValue = (value) => value ?? 0;

export const InboxSummaryGrid = ({
  summary = {},
  metrics = statusMetrics,
  formatValue = formatSummaryValue,
}) => {
  return (
    <Card className="rounded-3xl border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-xl)]">
      <CardHeader className="space-y-2 pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--color-inbox-foreground)]">
          Resumo
        </CardTitle>
        <CardDescription className="text-xs text-[color:var(--color-inbox-foreground-muted)]">
          Distribuição dos leads recebidos via WhatsApp conectado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4">
          {metrics.map((metric) => {
            const { key, label, accent, icon } = metric;

            return (
              <div
                key={key}
                className="space-y-1 rounded-2xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] px-3 py-3 text-[color:var(--color-inbox-foreground-muted)] shadow-[0_14px_30px_color-mix(in_srgb,var(--color-inbox-border)_48%,transparent)]"
              >
                <dt className="flex items-center gap-2 text-xs font-medium text-[color:var(--color-inbox-foreground-muted)]">
                  {icon ? icon : null}
                  <span>{label}</span>
                </dt>
                <dd className={cn('text-xl font-semibold text-[color:var(--color-inbox-foreground)]', accent ?? '')}>
                  {formatValue(summary?.[key], { key, summary, metric })}
                </dd>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
};

export default InboxSummaryGrid;
