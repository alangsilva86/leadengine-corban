import {
  BadgeCheck,
  Ban,
  Hash,
  Mail,
  Phone,
  ShieldCheck,
  Trophy,
  Wallet,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils.js';
import { formatCurrency, formatDocument } from '../utils/formatters.js';
import { InboxPrimaryButton } from './shared/InboxPrimaryButton.jsx';
import { InboxSurface } from './shared/InboxSurface.jsx';

const STATUS_META = {
  allocated: { label: 'Aguardando contato', tone: 'neutral' },
  contacted: { label: 'Em conversa', tone: 'info' },
  won: { label: 'Venda realizada', tone: 'success' },
  lost: { label: 'Sem interesse', tone: 'error' },
import { STATUS_META } from '../constants/statusMeta.js';
import { InboxPrimaryButton } from './shared/InboxPrimaryButton.jsx';

const formatCurrency = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
};

const formatDocument = (value) => {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return value;
};

const infoRows = (allocation) => {
  if (!allocation) {
    return [
      { label: 'Documento', value: '—', icon: Hash },
      { label: 'Telefone', value: '—', icon: Phone },
      { label: 'Margem bruta', value: '—', icon: Wallet },
      { label: 'Margem disponível', value: '—', icon: ShieldCheck },
    ];
  }

  return [
    { label: 'Documento', value: formatDocument(allocation.document), icon: Hash },
    { label: 'Telefone', value: allocation.phone ?? '—', icon: Phone },
    { label: 'Margem bruta', value: formatCurrency(allocation.margin), icon: Wallet },
    { label: 'Margem disponível', value: formatCurrency(allocation.netMargin ?? allocation.margin), icon: ShieldCheck },
  ];
};

const LeadProfilePanel = ({ allocation, onUpdateStatus, onOpenWhatsApp, isLoading, isSwitching }) => {
  const status = allocation?.status ?? 'allocated';
  const statusMeta = STATUS_META[status] ?? STATUS_META.allocated;
  const actions = [
    {
      key: 'contacted',
      label: 'Marcar em conversa',
      icon: BadgeCheck,
      status: 'contacted',
      disabled: !allocation || allocation.status === 'contacted' || allocation.status === 'won',
    },
    {
      key: 'won',
      label: 'Registrar venda',
      icon: Trophy,
      status: 'won',
      disabled: !allocation || allocation.status === 'won',
    },
    {
      key: 'lost',
      label: 'Sem interesse',
      icon: Ban,
      status: 'lost',
      disabled: !allocation || allocation.status === 'lost',
    },
  ];

  const showSkeleton = Boolean(isLoading);

  return (
    <InboxSurface
      as={Card}
      className={cn('transition-opacity duration-150 ease-out', isSwitching ? 'opacity-0' : 'opacity-100')}
      aria-busy={showSkeleton}
    >
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--color-inbox-foreground)]">
            Informações do lead
          </CardTitle>
          {showSkeleton ? (
            <div className="h-6 w-32 animate-pulse rounded-full bg-[color:var(--surface-overlay-quiet)]" />
          ) : allocation ? (
            <Badge
              variant="status"
              tone={statusMeta.tone}
              className="px-3 py-1 text-xs font-medium uppercase tracking-[0.26em]"
            >
              {statusMeta.label}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-[color:var(--color-inbox-foreground-muted)]">
          Dados essenciais sempre visíveis para agilizar o atendimento e garantir foco na conversa.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {showSkeleton ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`skeleton-info-${index}`} className="space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded-full bg-[color:var(--surface-overlay-quiet)]" />
                  <div className="h-4 w-full animate-pulse rounded-full bg-[color:var(--surface-overlay-quiet)]" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`skeleton-action-${index}`} className="h-10 animate-pulse rounded-2xl bg-[color:var(--surface-overlay-quiet)]" />
              ))}
            </div>

            <div className="h-8 w-3/4 animate-pulse rounded-2xl bg-[color:var(--surface-overlay-quiet)]" />
          </div>
        ) : (
          <>
            <InboxSurface
              radius="md"
              padding="md"
              shadow="none"
              className={cn('grid grid-cols-1 gap-3 text-sm text-[color:var(--color-inbox-foreground-muted)]', 'sm:grid-cols-2')}
            >
              {infoRows(allocation).map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-[color:var(--color-inbox-foreground-muted)]">
                      <Icon className="h-3.5 w-3.5 text-[color:var(--color-inbox-foreground-muted)]" />
                      <span>{row.label}</span>
                    </div>
                    <p className="text-sm font-medium text-[color:var(--color-inbox-foreground)]">{row.value || '—'}</p>
                  </div>
                );
              })}
            </InboxSurface>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InboxPrimaryButton
                type="button"
                size="sm"
                onClick={() => (allocation && onOpenWhatsApp ? onOpenWhatsApp(allocation) : null)}
                disabled={!allocation?.phone || !onOpenWhatsApp || showSkeleton}
                className="group flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-[0_12px_34px_color-mix(in_srgb,var(--accent-inbox-primary)_45%,transparent)]"
              >
                <Phone className="h-4 w-4" /> Abrir conversa
              </InboxPrimaryButton>
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.key}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={action.disabled || !onUpdateStatus || showSkeleton}
                    onClick={() =>
                      allocation && onUpdateStatus ? onUpdateStatus(allocation.allocationId, action.status) : null
                    }
                    className="flex items-center justify-center gap-2 rounded-2xl border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-quiet)] px-4 py-3 text-sm font-medium text-[color:var(--color-inbox-foreground)] transition hover:border-primary/40 hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_75%,transparent)]"
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </Button>
                );
              })}
            </div>

            {allocation?.email ? (
              <InboxSurface
                radius="md"
                shadow="none"
                className="flex items-center gap-2 px-3 py-2 text-xs text-[color:var(--color-inbox-foreground-muted)]"
              >
                <Mail className="h-4 w-4 text-[color:var(--color-inbox-foreground-muted)]" />
                <span>{allocation.email}</span>
              </InboxSurface>
            ) : null}
          </>
        )}
      </CardContent>
    </InboxSurface>
  );
};

export default LeadProfilePanel;
