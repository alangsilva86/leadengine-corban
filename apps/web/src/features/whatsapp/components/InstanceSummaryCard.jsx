import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';
import { Check, QrCode } from 'lucide-react';

import InstanceActionsMenu from './InstanceActionsMenu.jsx';
import InstanceMetricsTiles from './InstanceMetricsTiles.jsx';

const InstanceSummaryCard = ({
  surfaceStyles,
  viewModel,
  statusCodeMeta,
  isBusy,
  isAuthenticated,
  deletingInstanceId,
  onSelectInstance,
  onViewQr,
  onRequestDelete,
}) => {
  const {
    instance,
    displayName,
    formattedPhone,
    phoneLabel,
    addressLabel,
    statusInfo,
    metrics,
    statusValues,
    rateUsage,
    ratePercentage,
    lastUpdatedLabel,
    user,
    isCurrent,
  } = viewModel;

  const instanceStatus = (instance?.status ?? '').toLowerCase();
  const showQrButton = ['disconnected', 'qr_required', 'error'].includes(instanceStatus);

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col rounded-2xl border p-4 transition-colors',
        isCurrent ? surfaceStyles.glassTileActive : surfaceStyles.glassTileIdle,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{displayName}</p>
          <p className="text-xs text-muted-foreground">{formattedPhone || '—'}</p>
          {addressLabel && addressLabel !== phoneLabel ? (
            <p className="text-xs text-muted-foreground">{addressLabel}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          <InstanceActionsMenu
            instance={instance}
            deletingInstanceId={deletingInstanceId}
            isBusy={isBusy}
            isAuthenticated={isAuthenticated}
            onViewQr={onViewQr}
            onRequestDelete={onRequestDelete}
          />
        </div>
      </div>

      <div className="mt-4">
        <InstanceMetricsTiles
          surfaceStyles={surfaceStyles}
          metrics={metrics}
          statusValues={statusValues}
          statusCodeMeta={statusCodeMeta}
          rateUsage={rateUsage}
          ratePercentage={ratePercentage}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Atualizado: {lastUpdatedLabel}</span>
        {user ? <span>Operador: {user}</span> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {showQrButton ? (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 min-[320px]:flex-none"
            onClick={() => onViewQr?.(instance)}
          >
            <QrCode className="mr-2 h-4 w-4" />
            Gerar QR Code
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={isCurrent ? 'default' : 'outline'}
          onClick={() => onSelectInstance?.(instance)}
          disabled={isBusy}
          className={cn('flex-1 min-[320px]:flex-none', isCurrent ? 'whitespace-normal' : '')}
        >
          {isCurrent ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Instância selecionada
            </>
          ) : (
            'Selecionar instância'
          )}
        </Button>
      </div>
    </div>
  );
};

export default InstanceSummaryCard;
