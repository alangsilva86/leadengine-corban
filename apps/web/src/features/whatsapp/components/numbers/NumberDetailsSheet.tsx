import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { isDiagnosticsEnabled } from '@/lib/features.js';
import { Activity, MessageSquare, Trash2, Unplug } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet.jsx';

import NumberStatusBadge from './NumberStatusBadge';
import { diagnosticsHref, type NumberAction } from './NumberActionsMenu';
import SafetyTipsPopover from '../SafetyTips';
import { formatTimestampLabel } from '../../lib/formatting';
import type { WhatsAppNumber } from '../../hooks/useWhatsAppNumbers';

interface NumberDetailsSheetProps {
  number: WhatsAppNumber | null;
  onOpenChange: (open: boolean) => void;
  onAction: (action: NumberAction, number: WhatsAppNumber) => void;
}

const DetailRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 py-3">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="text-right text-sm font-medium text-foreground">{children}</dd>
  </div>
);

/** Detalhes de um número com as ações disponíveis para o status atual. */
const NumberDetailsSheet = ({ number, onOpenChange, onAction }: NumberDetailsSheetProps) => {
  const open = Boolean(number);
  const status = number?.status;
  const showConnect = Boolean(number && status && !status.isConnected && status.key !== 'connecting' && !number.isSessionOnly);
  const showDisconnect = Boolean(number && status && (status.isConnected || status.key === 'connecting' || number.isSessionOnly));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-[440px]">
        {number && status ? (
          <div className="flex min-h-full flex-col">
            <SheetHeader className="gap-2 border-b border-border px-6 py-5">
              <SheetTitle className="pr-8 text-lg">{number.name}</SheetTitle>
              <NumberStatusBadge status={status} />
              <SheetDescription>{status.description}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-6 px-6 py-5">
              {showConnect ? (
                <Button type="button" className="w-full" onClick={() => onAction('connect', number)}>
                  {status.actionLabel ?? 'Conectar'}
                </Button>
              ) : null}
              {status.isConnected ? (
                <Button asChild variant="outline" className="w-full">
                  <Link to="/inbox">
                    <MessageSquare aria-hidden="true" />
                    Abrir Inbox
                  </Link>
                </Button>
              ) : null}

              <dl className="divide-y divide-border">
                <DetailRow label="Número">{number.phone ?? 'Ainda não pareado'}</DetailRow>
                <DetailRow label="Última atividade">
                  {number.lastActivityLabel ? (
                    <span title={formatTimestampLabel(number.lastActivityAt)}>{number.lastActivityLabel}</span>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow label="Mensagens enviadas">
                  {typeof number.sentCount === 'number' ? new Intl.NumberFormat('pt-BR').format(number.sentCount) : '—'}
                </DetailRow>
              </dl>

              {isDiagnosticsEnabled() ? (
                <div className="space-y-2 rounded-lg border border-border bg-surface-sunken p-4">
                  <p className="text-sm font-medium text-foreground">Problemas com este número?</p>
                  <p className="text-xs text-muted-foreground">
                    O diagnóstico mostra os eventos recentes da conexão. Útil para enviar ao suporte.
                  </p>
                  <Button asChild variant="link" size="sm" className="has-[>svg]:px-0">
                    <Link to={diagnosticsHref(number)}>
                      <Activity aria-hidden="true" />
                      Ver diagnóstico
                    </Link>
                  </Button>
                </div>
              ) : null}

              <SafetyTipsPopover align="start" />
            </div>

            <SheetFooter className="flex-row flex-wrap justify-between gap-2 border-t border-border px-6 py-4">
              {showDisconnect ? (
                <Button type="button" variant="outline" size="sm" onClick={() => onAction('disconnect', number)}>
                  <Unplug aria-hidden="true" />
                  Desconectar
                </Button>
              ) : (
                <span />
              )}
              {!number.isSessionOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:bg-danger-soft hover:text-danger-soft-foreground"
                  onClick={() => onAction('delete', number)}
                >
                  <Trash2 aria-hidden="true" />
                  Excluir número
                </Button>
              ) : null}
            </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

export default NumberDetailsSheet;
