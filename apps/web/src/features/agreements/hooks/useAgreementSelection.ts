import { useCallback, useEffect, useMemo, useState } from 'react';
import { createEmptyAgreement } from '@/features/agreements/domain/createEmptyAgreement.ts';
import { resolveProviderId } from '@/features/agreements/convenioSettings.utils.ts';
import useConvenioCatalog from '@/features/agreements/useConvenioCatalog.ts';

import type { Agreement, UseConvenioCatalogReturn } from '@/features/agreements/useConvenioCatalog.ts';

export type AgreementSelectionState = {
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
  isCreating: boolean;
};

export type AgreementSelectionActions = {
  setRole: (value: string) => void;
  setRequireApproval: (value: boolean) => void;
  refresh: UseConvenioCatalogReturn['refetch'];
  selectConvenio: (id: string | null) => void;
  createConvenio: () => Promise<string | null>;
  cancelPending: () => void;
};

export type AgreementSelectionContext = {
  historyAuthor: string;
  role: string;
  locked: boolean;
  selected: Agreement | null;
  pendingAgreement: Agreement | null;
  setPendingAgreement: (agreement: Agreement | null) => void;
  setSelectedId: (id: string | null) => void;
  mutations: UseConvenioCatalogReturn['mutations'];
  allAgreements: Agreement[];
};

export type UseAgreementSelectionReturn = {
  state: AgreementSelectionState;
  actions: AgreementSelectionActions;
  context: AgreementSelectionContext;
};

const resolveHistoryAuthor = (role: string): string => {
  if (role === 'seller') {
    return 'Sugestão do vendedor';
  }
  if (role === 'coordinator') {
    return 'Coordenador';
  }
  return 'Admin';
};

const useAgreementSelection = (): UseAgreementSelectionReturn => {
  const [role, setRole] = useState('admin');
  const [requireApproval, setRequireApproval] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingAgreement, setPendingAgreement] = useState<Agreement | null>(null);

  const { convenios, isLoading, isFetching, error, refetch, mutations } = useConvenioCatalog();

  useEffect(() => {
    if (pendingAgreement) {
      setSelectedId(pendingAgreement.id);
      return;
    }

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
  }, [convenios, pendingAgreement]);

  const selected = useMemo(
    () => pendingAgreement ?? convenios.find((item) => item.id === selectedId) ?? null,
    [convenios, pendingAgreement, selectedId]
  );

  const isCreating = Boolean(pendingAgreement && pendingAgreement.id === selected?.id);

  const displayedConvenios = useMemo(() => {
    if (!pendingAgreement) {
      return convenios;
    }
    return [pendingAgreement, ...convenios.filter((item) => item.id !== pendingAgreement.id)];
  }, [convenios, pendingAgreement]);

  const readOnly = role === 'seller';
  const locked = readOnly || (requireApproval && role === 'coordinator');
  const historyAuthor = resolveHistoryAuthor(role);

  const handleSelectConvenio = useCallback((id: string | null) => {
    setPendingAgreement(null);
    setSelectedId(id);
  }, []);

  const cancelPending = useCallback(() => {
    setPendingAgreement(null);
  }, []);

  const setPendingAgreementDirect = useCallback((agreement: Agreement | null) => {
    setPendingAgreement(agreement);
  }, []);

  const setSelectedIdDirect = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const createConvenio = useCallback(async () => {
    if (locked) {
      return null;
    }

    const convenio = createEmptyAgreement({ author: historyAuthor });
    setPendingAgreement(convenio);
    setSelectedId(convenio.id);
    return convenio.id;
  }, [historyAuthor, locked]);

  const selectedProviderId = selected ? resolveProviderId(selected.metadata) : null;

  return {
    state: {
      role,
      requireApproval,
      readOnly,
      locked,
      convenios: displayedConvenios,
      selected,
      isLoading,
      isFetching,
      error,
      selectedProviderId,
      isSyncingProvider: mutations.syncProvider.isPending,
      isCreating,
    },
    actions: {
      setRole,
      setRequireApproval,
      refresh: refetch,
      selectConvenio: handleSelectConvenio,
      createConvenio,
      cancelPending,
    },
    context: {
      historyAuthor,
      role,
      locked,
      selected,
      pendingAgreement,
      setPendingAgreement: setPendingAgreementDirect,
      setSelectedId: setSelectedIdDirect,
      mutations,
      allAgreements: convenios,
    },
  };
};

export default useAgreementSelection;
