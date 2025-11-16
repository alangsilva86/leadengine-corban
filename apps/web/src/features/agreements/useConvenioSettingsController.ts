import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import emitAgreementsTelemetry from '@/features/agreements/utils/telemetry.ts';
import useConvenioCatalog, { Agreement } from './useConvenioCatalog.ts';
import { STATUS_OPTIONS } from './convenioSettings.constants.ts';
import { formatDate, getErrorMessage, resolveProviderId } from './convenioSettings.utils.ts';
import { createHistoryEntry } from './domain/createHistoryEntry.ts';
import { buildAgreementPayload } from './domain/buildAgreementPayload.ts';
import { createEmptyAgreement } from './domain/createEmptyAgreement.ts';

type UpdateBasicPayload = {
  nome: string;
  averbadora: string;
  tipo: string;
  status: string;
  produtos: string[];
  responsavel: string;
};

type WindowPayload = {
  id: string;
  label: string;
  start: Date;
  end: Date;
  firstDueDate: Date;
};

type TaxPayload = {
  id: string;
  produto: string;
  modalidade: string;
  monthlyRate: number;
  tacPercent: number;
  tacFlat: number;
  validFrom: Date;
  validUntil: Date | null;
};

type RunUpdateArgs = {
  nextAgreement: Agreement;
  toastMessage: string;
  telemetryEvent: string;
  telemetryPayload?: Record<string, unknown>;
  note?: string;
  errorMessage?: string;
  action?: 'update' | 'create';
};

type ControllerState = {
  role: string;
  requireApproval: boolean;
  readOnly: boolean;
  locked: boolean;
  convenios: Agreement[];
  selected: Agreement | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  selectedProviderId: string | null;
  isSyncingProvider: boolean;
};

type ControllerActions = {
  setRole: (value: string) => void;
  setRequireApproval: (value: boolean) => void;
  refresh: () => void;
  selectConvenio: (id: string | null) => void;
  createConvenio: () => Promise<string | null>;
  archiveConvenio: (id: string) => Promise<void>;
  updateBasic: (payload: UpdateBasicPayload) => Promise<void>;
  upsertWindow: (payload: WindowPayload) => Promise<void>;
  removeWindow: (windowId: string) => Promise<void>;
  upsertTax: (payload: TaxPayload) => Promise<void>;
  syncProvider: () => Promise<void>;
};

type ImportDialogState = {
  mutation: ReturnType<typeof useConvenioCatalog>['mutations']['importAgreements'];
};

export type UseConvenioSettingsControllerReturn = {
  state: ControllerState;
  actions: ControllerActions;
  helpers: ImportDialogState;
};

const useConvenioSettingsController = (): UseConvenioSettingsControllerReturn => {
  const [role, setRole] = useState('admin');
  const [requireApproval, setRequireApproval] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { convenios, isLoading, isFetching, error, refetch, mutations } = useConvenioCatalog();

  useEffect(() => {
    if (!convenios.length) {
      setSelectedId(null);
      return;
    }

    setSelectedId((current) => {
      if (current && convenios.some((item) => item.id === current)) {
        return current;
      }
      return convenios[0]?.id ?? null;
    });
  }, [convenios]);

  const selected = useMemo(() => convenios.find((item) => item.id === selectedId) ?? null, [convenios, selectedId]);

  const readOnly = role === 'seller';
  const locked = readOnly || (requireApproval && role === 'coordinator');

  const historyAuthor = useMemo(() => {
    if (role === 'seller') {
      return 'Sugestão do vendedor';
    }
    if (role === 'coordinator') {
      return 'Coordenador';
    }
    return 'Admin';
  }, [role]);

  const buildHistoryEntry = useCallback(
    (message: string) =>
      createHistoryEntry({
        author: historyAuthor,
        message,
      }),
    [historyAuthor]
  );

  const runUpdate = useCallback(
    async ({
      nextAgreement,
      toastMessage,
      telemetryEvent,
      telemetryPayload = {},
      note,
      errorMessage = 'Falha ao atualizar convênio',
      action = 'update',
    }: RunUpdateArgs) => {
      try {
        const payload = buildAgreementPayload({
          agreement: nextAgreement,
          actor: historyAuthor,
          actorRole: role,
          note,
        });

        const response =
          action === 'create'
            ? await mutations.createAgreement.mutateAsync({ payload })
            : await mutations.updateAgreement.mutateAsync({ agreementId: nextAgreement.id, payload });

        const agreementId = response?.data?.id ?? nextAgreement.id;
        toast.success(toastMessage);
        emitAgreementsTelemetry(telemetryEvent, { ...telemetryPayload, agreementId, role });
        return response?.data ?? null;
      } catch (err) {
        toast.error(getErrorMessage(err, errorMessage));
        return null;
      }
    },
    [historyAuthor, mutations.createAgreement, mutations.updateAgreement, role]
  );

  const updateBasic = useCallback(
    async (payload: UpdateBasicPayload) => {
      if (!selected || locked) {
        return;
      }

      const entry = buildHistoryEntry(
        `Dados básicos atualizados: ${payload.nome} (${STATUS_OPTIONS.find((item) => item.value === payload.status)?.label ?? payload.status}).`
      );

      const next: Agreement = {
        ...selected,
        nome: payload.nome,
        averbadora: payload.averbadora,
        tipo: payload.tipo,
        status: payload.status,
        produtos: [...payload.produtos],
        responsavel: payload.responsavel,
        history: [entry, ...selected.history],
      };

      await runUpdate({
        nextAgreement: next,
        toastMessage: 'Dados básicos salvos com sucesso',
        telemetryEvent: 'agreements.basic.updated',
        telemetryPayload: { status: payload.status },
        note: entry.message,
      });
    },
    [buildHistoryEntry, locked, runUpdate, selected]
  );

  const upsertWindow = useCallback(
    async (payload: WindowPayload) => {
      if (!selected || locked) {
        return;
      }

      const exists = selected.janelas.some((window) => window.id === payload.id);
      const janelas = exists
        ? selected.janelas.map((window) => (window.id === payload.id ? payload : window))
        : [...selected.janelas, payload];

      const entry = buildHistoryEntry(
        `Janela ${payload.label} ${exists ? 'atualizada' : 'cadastrada'} (${formatDate(payload.start)} até ${formatDate(payload.end)}).`
      );

      const next: Agreement = {
        ...selected,
        janelas,
        history: [entry, ...selected.history],
      };

      await runUpdate({
        nextAgreement: next,
        toastMessage: 'Calendário salvo com sucesso',
        telemetryEvent: 'agreements.window.upserted',
        telemetryPayload: { windowId: payload.id, hasOverlap: false },
        note: entry.message,
      });
    },
    [buildHistoryEntry, locked, runUpdate, selected]
  );

  const removeWindow = useCallback(
    async (windowId: string) => {
      if (!selected || locked) {
        return;
      }

      const entry = buildHistoryEntry('Janela removida do calendário.');
      const next: Agreement = {
        ...selected,
        janelas: selected.janelas.filter((window) => window.id !== windowId),
        history: [entry, ...selected.history],
      };

      await runUpdate({
        nextAgreement: next,
        toastMessage: 'Janela removida',
        telemetryEvent: 'agreements.window.removed',
        telemetryPayload: { windowId },
        note: entry.message,
      });
    },
    [buildHistoryEntry, locked, runUpdate, selected]
  );

  const upsertTax = useCallback(
    async (payload: TaxPayload) => {
      if (!selected || locked) {
        return;
      }

      const exists = selected.taxas.some((tax) => tax.id === payload.id);
      const taxas = exists
        ? selected.taxas.map((tax) => (tax.id === payload.id ? payload : tax))
        : [...selected.taxas, payload];

      const entry = buildHistoryEntry(
        `${payload.modalidade} atualizado para ${payload.monthlyRate?.toFixed(2)}% (${payload.produto}).`
      );

      const next: Agreement = {
        ...selected,
        taxas,
        history: [entry, ...selected.history],
      };

      await runUpdate({
        nextAgreement: next,
        toastMessage: 'Taxa salva com sucesso',
        telemetryEvent: 'agreements.rate.upserted',
        telemetryPayload: { modalidade: payload.modalidade, produto: payload.produto },
        note: entry.message,
      });
    },
    [buildHistoryEntry, locked, runUpdate, selected]
  );

  const archiveConvenio = useCallback(
    async (convenioId: string) => {
      const target = convenios.find((item) => item.id === convenioId);
      if (!target || locked) {
        return;
      }

      const entry = buildHistoryEntry('Convênio arquivado pelo gestor.');
      const next: Agreement = {
        ...target,
        archived: true,
        status: target.status === 'ATIVO' ? 'PAUSADO' : target.status,
        history: [entry, ...target.history],
      };

      await runUpdate({
        nextAgreement: next,
        toastMessage: 'Convênio arquivado',
        telemetryEvent: 'agreements.archived',
        telemetryPayload: {},
        note: entry.message,
        errorMessage: 'Falha ao arquivar convênio',
      });
    },
    [convenios, buildHistoryEntry, locked, runUpdate]
  );

  const createConvenio = useCallback(async () => {
    if (locked) {
      return null;
    }

    const convenio = createEmptyAgreement({ author: historyAuthor });

    const response = await runUpdate({
      nextAgreement: convenio,
      toastMessage: 'Convênio criado',
      telemetryEvent: 'agreements.created',
      telemetryPayload: {},
      note: 'Convênio criado manualmente pelo gestor.',
      errorMessage: 'Falha ao criar convênio',
      action: 'create',
    });

    const agreementId = response?.id ?? convenio.id;
    setSelectedId(agreementId);
    return agreementId;
  }, [historyAuthor, locked, runUpdate]);

  const selectConvenio = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const syncProvider = useCallback(async () => {
    if (!selected || locked) {
      return;
    }

    const providerId = resolveProviderId(selected.metadata);
    if (!providerId) {
      toast.error('Sincronização disponível apenas para convênios integrados.');
      return;
    }

    try {
      await mutations.syncProvider.mutateAsync({
        providerId,
        payload: { requestedBy: role, reason: 'manual-trigger' },
      });
      toast.success('Sincronização enviada para processamento');
      emitAgreementsTelemetry('agreements.sync.triggered', { agreementId: selected.id, providerId, role });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Falha ao acionar sincronização'));
    }
  }, [locked, mutations.syncProvider, role, selected]);

  const selectedProviderId = selected ? resolveProviderId(selected.metadata) : null;

  return {
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
      isSyncingProvider: mutations.syncProvider.isPending,
    },
    actions: {
      setRole,
      setRequireApproval,
      refresh: refetch,
      selectConvenio,
      createConvenio,
      archiveConvenio,
      updateBasic,
      upsertWindow,
      removeWindow,
      upsertTax,
      syncProvider,
    },
    helpers: {
      mutation: mutations.importAgreements,
    },
  };
};

export default useConvenioSettingsController;
