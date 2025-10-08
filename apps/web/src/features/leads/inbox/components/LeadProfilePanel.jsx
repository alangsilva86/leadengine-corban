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

const STATUS_LABEL = {
  allocated: 'Aguardando contato',
  contacted: 'Em conversa',
  won: 'Venda realizada',
  lost: 'Sem interesse',
};

const STATUS_TONE = {
  allocated: 'border-white/20 bg-white/[0.08] text-white/80',
  contacted: 'border-sky-400/40 bg-sky-500/20 text-sky-100',
  won: 'border-emerald-400/45 bg-emerald-400/20 text-emerald-100',
  lost: 'border-rose-500/50 bg-rose-500/18 text-rose-100',
};

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
  const statusLabel = STATUS_LABEL[status] ?? 'Em acompanhamento';
  const statusTone = STATUS_TONE[status] ?? STATUS_TONE.allocated;
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
    <Card
      className={cn(
        'rounded-3xl border-surface-contrast bg-white/[0.08] shadow-[0_18px_40px_rgba(5,12,30,0.45)] transition-opacity duration-150 ease-out',
        isSwitching ? 'opacity-0' : 'opacity-100'
      )}
      aria-busy={showSkeleton}
    >
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-[0.12em] text-white/80">
            Informações do lead
          </CardTitle>
          {showSkeleton ? (
            <div className="h-6 w-32 animate-pulse rounded-full bg-white/12" />
          ) : allocation ? (
            <Badge
              variant="outline"
              className={cn(
                'border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.26em] text-white/80 transition-colors',
                statusTone
              )}
            >
              {statusLabel}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-white/70">
          Dados essenciais sempre visíveis para agilizar o atendimento e garantir foco na conversa.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {showSkeleton ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`skeleton-info-${index}`} className="space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded-full bg-white/12" />
                  <div className="h-4 w-full animate-pulse rounded-full bg-white/12" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`skeleton-action-${index}`} className="h-10 animate-pulse rounded-2xl bg-white/12" />
              ))}
            </div>

            <div className="h-8 w-3/4 animate-pulse rounded-2xl bg-white/12" />
          </div>
        ) : (
          <>
            <div className={cn('grid grid-cols-1 gap-3 rounded-2xl border border-white/12 bg-white/[0.06] p-4 text-sm text-white/80', 'sm:grid-cols-2')}>
              {infoRows(allocation).map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/65">
                      <Icon className="h-3.5 w-3.5 text-white/70" />
                      <span>{row.label}</span>
                    </div>
                    <p className="text-sm font-medium text-white/90">{row.value || '—'}</p>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                type="button"
                size="sm"
                onClick={() => (allocation && onOpenWhatsApp ? onOpenWhatsApp(allocation) : null)}
                disabled={!allocation?.phone || !onOpenWhatsApp || showSkeleton}
                className="group flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-medium text-emerald-950 shadow-[0_12px_34px_rgba(16,185,129,0.45)] transition hover:bg-emerald-400"
              >
                <Phone className="h-4 w-4" /> Abrir conversa
              </Button>
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
                    className="flex items-center justify-center gap-2 rounded-2xl border-surface-contrast bg-white/[0.08] px-4 py-3 text-sm font-medium text-white/90 transition hover:border-white/30 hover:bg-white/[0.12]"
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </Button>
                );
              })}
            </div>

            {allocation?.email ? (
              <div className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.08] px-3 py-2 text-xs text-white/75">
                <Mail className="h-4 w-4 text-white/65" />
                <span>{allocation.email}</span>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default LeadProfilePanel;
