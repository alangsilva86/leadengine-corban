import { useCallback, useEffect, useState } from 'react';

type UseAgreementSelectionArgs = {
  selectedId: string | null;
  isDesktop: boolean;
};

type SelectCallback = (id: string) => void;

type CreateCallback = () => Promise<string | null>;

const useAgreementSelection = ({ selectedId, isDesktop }: UseAgreementSelectionArgs) => {
  const [detailsOpen, setDetailsOpen] = useState(isDesktop);

  useEffect(() => {
    if (isDesktop) {
      setDetailsOpen(true);
      return;
    }

    setDetailsOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    if (!selectedId) {
      setDetailsOpen(false);
    }
  }, [selectedId]);

  const selectAgreement = useCallback(
    (agreementId: string, callback?: SelectCallback) => {
      if (!agreementId) {
        return;
      }

      callback?.(agreementId);
      setDetailsOpen(true);
    },
    []
  );

  const createAgreement = useCallback(
    async (creator?: CreateCallback) => {
      if (!creator) {
        return null;
      }

      const createdId = await creator();
      if (createdId) {
        setDetailsOpen(true);
      }

      return createdId;
    },
    []
  );

  return {
    detailsOpen,
    sheetOpen: Boolean(selectedId) && detailsOpen,
    setDetailsOpen,
    selectAgreement,
    createAgreement,
  } as const;
};

export default useAgreementSelection;
