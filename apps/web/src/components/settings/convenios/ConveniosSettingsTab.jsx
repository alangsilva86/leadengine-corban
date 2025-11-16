import { useEffect, useState } from 'react';
import { RefreshCw, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { cn } from '@/lib/utils.js';
import useMediaQuery from '@/hooks/use-media-query.js';
import AgreementImportDialog from './AgreementImportDialog.tsx';
import ConvenioList from './list/ConvenioList.jsx';
import ConvenioDetails from './ConvenioDetails.jsx';
import useConvenioSettingsController from '@/features/agreements/useConvenioSettingsController.ts';
import { ROLE_OPTIONS, STATUS_OPTIONS } from '@/features/agreements/convenioSettings.constants.ts';
import emitAgreementsTelemetry from '@/features/agreements/utils/telemetry.ts';
import { getErrorMessage } from '@/features/agreements/convenioSettings.utils.ts';

const ConveniosSettingsTab = () => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const {
    state: {
      role,
      requireApproval,
      readOnly,
      locked,
      convenios,
      selected,
      isLoading,
      isFetching,
      error,
      selectedProviderId,
      isSyncingProvider,
    },
    actions: {
      setRole,
      setRequireApproval,
      refresh,
      selectConvenio,
      createConvenio,
      archiveConvenio,
      updateBasic,
      upsertWindow,
      removeWindow,
      upsertTax,
      syncProvider,
    },
    helpers: { mutation: importMutation },
  } = useConvenioSettingsController();

  useEffect(() => {
    if (isDesktop) {
      setDetailsOpen(true);
      return;
    }

    setDetailsOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    if (!selected) {
      setDetailsOpen(false);
    }
  }, [selected]);

  const handleSelectConvenio = (convenioId) => {
    selectConvenio(convenioId);
    setDetailsOpen(true);
  };

  const handleCreateConvenio = async () => {
    const createdId = await createConvenio();
    if (createdId) {
      setDetailsOpen(true);
    }
  };

  const sheetOpen = detailsOpen && Boolean(selected);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <CardTitle>Convênios &amp; Tabelas</CardTitle>
            <CardDescription>
              Gestão comercial sem falar em coeficiente. Configure convênios, janelas e taxas e deixe o motor calcular.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCircle className="h-4 w-4" /> Perfil
            </div>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full min-w-[200px] md:w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
              Exigir aprovação para publicar alterações
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <div className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <span>{getErrorMessage(error, 'Falha ao carregar convênios')}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => refresh()}>
                Tentar novamente
              </Button>
            </div>
          ) : null}
          <ConvenioList
            convenios={convenios}
            selectedId={selected?.id ?? null}
            onSelect={handleSelectConvenio}
            onArchive={archiveConvenio}
            readOnly={locked}
            onCreate={handleCreateConvenio}
            onOpenImport={() => setImportOpen(true)}
            onRefresh={refresh}
            isLoading={isLoading}
            isFetching={isFetching}
          />
          <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Governança</p>
            <p>
              Gestores editam diretamente. Coordenadores podem exigir aprovação antes de publicar. Vendedores enxergam tudo e usam nas simulações, mas não mexem nas tabelas.
            </p>
          </div>
        </CardContent>
      </Card>
      <Sheet open={sheetOpen} onOpenChange={setDetailsOpen}>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={syncProvider}
                  disabled={isSyncingProvider || locked || !selectedProviderId}
                >
                  <RefreshCw className={cn('mr-2 h-4 w-4', isSyncingProvider ? 'animate-spin' : '')} />
                  Sincronizar provedor
                </Button>
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
              <ConvenioDetails
                convenio={selected}
                onUpdateBasic={updateBasic}
                onUpsertWindow={upsertWindow}
                onRemoveWindow={removeWindow}
                onUpsertTax={upsertTax}
                readOnly={locked}
              />
            </div>
          </SheetContent>
        ) : null}
      </Sheet>
      <AgreementImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        mutation={importMutation}
        onImported={(response) => {
          toast.success(
            `Importação concluída: ${response.data.imported} novos, ${response.data.updated} atualizados, ${response.data.failed} falhas.`
          );
          emitAgreementsTelemetry('agreements.import.completed', {
            imported: response.data.imported,
            updated: response.data.updated,
            failed: response.data.failed,
          });
          refresh();
          setImportOpen(false);
        }}
      />
    </div>
  );
};

export default ConveniosSettingsTab;
