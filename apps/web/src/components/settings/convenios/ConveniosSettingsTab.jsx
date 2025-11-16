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
    return 'Admin';
  }, [role]);

  const buildErrorMessage = (apiError, fallback) =>
    apiError?.payload?.error?.message ?? (apiError instanceof Error ? apiError.message : fallback);

  const buildAuditMeta = (note) => ({
    audit: {
      actor: historyAuthor,
      actorRole: role,
      note,
    },
  });

  const runUpdate = async ({
    nextAgreement,
    toastMessage,
    telemetryEvent,
    telemetryPayload = {},
    note,
    errorMessage = 'Falha ao atualizar convênio',
    action = 'update',
  }) => {
    try {
      const payload = {
        data: serializeAgreement(nextAgreement),
        meta: buildAuditMeta(note),
      };

      const response =
        action === 'create'
          ? await mutations.createAgreement.mutateAsync({ payload })
          : await mutations.updateAgreement.mutateAsync({ agreementId: nextAgreement.id, payload });

      const agreementId = response?.data?.id ?? nextAgreement.id;
      toast.success(toastMessage);
      emitAgreementsTelemetry(telemetryEvent, { ...telemetryPayload, agreementId, role });
      return response?.data ?? null;
    } catch (err) {
      toast.error(buildErrorMessage(err, errorMessage));
      return null;
    }
  };

  const handleUpdateBasic = async (payload) => {
    if (!selected || locked) {
      return;
    }

    const next = {
      ...selected,
      nome: payload.nome,
      averbadora: payload.averbadora,
      tipo: payload.tipo,
      status: payload.status,
      produtos: [...payload.produtos],
      responsavel: payload.responsavel,
    };

    await runUpdate({
      nextAgreement: next,
      toastMessage: 'Dados básicos salvos com sucesso',
      telemetryEvent: 'agreements.basic.updated',
      telemetryPayload: { status: payload.status },
      note: `Dados básicos atualizados: ${payload.nome} (${STATUS_OPTIONS.find((item) => item.value === payload.status)?.label ?? payload.status}).`,
    });
  };

  const buildWindowPayload = (payload) => {
    const current = selected?.janelas.find((window) => window.id === payload.id) ?? null;
    const metadata = { ...(current?.metadata ?? {}) };
    metadata.firstDueDate = payload.firstDueDate.toISOString();
    return {
      id: payload.id,
      tableId: current?.tableId ?? null,
      label: payload.label,
      startsAt: payload.start.toISOString(),
      endsAt: payload.end.toISOString(),
      isActive: current?.isActive ?? true,
      metadata,
    };
  };

  const buildRatePayload = (payload) => {
    const current = selected?.taxas.find((tax) => tax.id === payload.id) ?? null;
    const metadata = { ...(current?.metadata ?? {}) };
    metadata.validFrom = payload.validFrom.toISOString();
    metadata.validUntil = payload.validUntil ? payload.validUntil.toISOString() : null;
    metadata.tacFlat = payload.tacFlat ?? 0;
    metadata.status = payload.status ?? 'Ativa';
    metadata.tacPercent = payload.tacPercent ?? 0;
    return {
      id: payload.id,
      tableId: current?.tableId ?? null,
      windowId: current?.windowId ?? null,
      product: payload.produto,
      modality: payload.modalidade,
      termMonths: current?.termMonths ?? null,
      coefficient: current?.coefficient ?? null,
      monthlyRate: payload.monthlyRate,
      annualRate: current?.annualRate ?? null,
      tacPercentage: payload.tacPercent ?? current?.tacPercentage ?? 0,
      metadata,
    };
  };

  const handleUpsertWindow = async (payload) => {
    if (!selected || locked) {
      return;
    }
    const note = `Janela ${payload.label || 'do convênio'} (${formatDate(payload.start)} até ${formatDate(payload.end)}) atualizada.`;

    try {
      const response = await mutations.upsertWindow.mutateAsync({
        agreementId: selected.id,
        payload: {
          data: buildWindowPayload(payload),
          meta: buildAuditMeta(note),
        },
      });
      const windowId = response?.data?.id ?? payload.id;
      toast.success('Calendário salvo com sucesso');
      emitAgreementsTelemetry('agreements.window.upserted', {
        agreementId: selected.id,
        windowId,
        hasOverlap: false,
        role,
      });
    } catch (err) {
      toast.error(buildErrorMessage(err, 'Falha ao salvar calendário'));
    }
  };

  const handleRemoveWindow = async (windowId) => {
    if (!selected || locked) {
      return;
    }
    const note = 'Janela removida do calendário.';

    try {
      await mutations.removeWindow.mutateAsync({
        agreementId: selected.id,
        windowId,
        meta: buildAuditMeta(note),
      });
      toast.success('Janela removida');
      emitAgreementsTelemetry('agreements.window.removed', { agreementId: selected.id, windowId, role });
    } catch (err) {
      toast.error(buildErrorMessage(err, 'Falha ao remover janela'));
    }
  };

  const handleUpsertTax = async (payload) => {
    if (!selected || locked) {
      return;
    }
    const note = `${payload.modalidade} atualizada para ${formatPercent(payload.monthlyRate)} (${payload.produto}).`;

    try {
      const response = await mutations.upsertRate.mutateAsync({
        agreementId: selected.id,
        payload: {
          data: buildRatePayload(payload),
          meta: buildAuditMeta(note),
        },
      });
      const rateId = response?.data?.id ?? payload.id;
      toast.success('Taxa salva com sucesso');
      emitAgreementsTelemetry('agreements.rate.upserted', {
        agreementId: selected.id,
        rateId,
        modalidade: payload.modalidade,
        produto: payload.produto,
        role,
      });
    } catch (err) {
      toast.error(buildErrorMessage(err, 'Falha ao salvar taxa'));
    }
  };

  const handleArchive = async (convenioId) => {
    const target = convenios.find((item) => item.id === convenioId);
    if (!target || locked) {
      return;
    }

    const next = {
      ...target,
      archived: true,
      status: target.status === 'ATIVO' ? 'PAUSADO' : target.status,
    };

    await runUpdate({
      nextAgreement: next,
      toastMessage: 'Convênio arquivado',
      telemetryEvent: 'agreements.archived',
      telemetryPayload: {},
      note: 'Convênio arquivado pelo gestor.',
      errorMessage: 'Falha ao arquivar convênio',
    });
  };

  const handleCreateConvenio = async () => {
    if (locked) {
      return;
    }

    const convenio = {
      id: generateId(),
      nome: 'Novo convênio',
      averbadora: '',
      tipo: 'MUNICIPAL',
      status: 'EM_IMPLANTACAO',
      produtos: [],
      responsavel: '',
      archived: false,
      metadata: {},
      janelas: [],
      taxas: [],
      history: [],
    };

    const response = await runUpdate({
      nextAgreement: convenio,
      toastMessage: 'Convênio criado',
      telemetryEvent: 'agreements.created',
      telemetryPayload: {},
      note: 'Convênio criado manualmente pelo gestor.',
      errorMessage: 'Falha ao criar convênio',
      action: 'create',
    });

    if (response) {
      setSelectedId(response.id ?? convenio.id);
      setDetailsOpen(true);
    }
  };
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
