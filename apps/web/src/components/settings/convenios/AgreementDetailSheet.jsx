import { Suspense, lazy } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet.jsx';
import { cn } from '@/lib/utils.js';
import { STATUS_OPTIONS } from '@/features/agreements/convenioSettings.constants.ts';
import ProviderSyncButton from './ProviderSyncButton.jsx';

const ConvenioDetails = lazy(() => import('./ConvenioDetails.jsx'));

const AgreementDetailSheet = ({
  open,
  onOpenChange,
  selected,
  isDesktop,
  requireApproval,
  role,
  locked,
  selectedProviderId,
  isSyncing,
  onSync,
  onUpdateBasic,
  onUpsertWindow,
  onRemoveWindow,
  onUpsertTax,
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    {selected ? (
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className={cn(
          'flex w-full flex-col gap-4',
          isDesktop ? 'h-full sm:max-w-xl lg:max-w-3xl' : 'h-[85vh] max-w-none'
        )}
      >
        <SheetHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SheetTitle className="text-base font-semibold">{selected.nome}</SheetTitle>
              <SheetDescription>
                Averbadora: {selected.averbadora || '—'} ·{' '}
                {STATUS_OPTIONS.find((item) => item.value === selected.status)?.label ?? selected.status}
              </SheetDescription>
            </div>
            <ProviderSyncButton
              onSync={onSync}
              isSyncing={isSyncing}
              disabled={isSyncing || locked || !selectedProviderId}
            />
          </div>
        </SheetHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-6">
          {selected.archived ? (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              Arquivado — permanece no histórico, mas não aparece para novas simulações
            </Badge>
          ) : null}
          {requireApproval && role === 'coordinator' ? (
            <Badge variant="secondary" className="text-xs">
              Alterações enviadas aguardam aprovação do gestor
            </Badge>
          ) : null}
          <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando convênio...</div>}>
            <ConvenioDetails
              convenio={selected}
              onUpdateBasic={onUpdateBasic}
              onUpsertWindow={onUpsertWindow}
              onRemoveWindow={onRemoveWindow}
              onUpsertTax={onUpsertTax}
              readOnly={locked}
            />
          </Suspense>
        </div>
      </SheetContent>
    ) : null}
  </Sheet>
);

export default AgreementDetailSheet;
