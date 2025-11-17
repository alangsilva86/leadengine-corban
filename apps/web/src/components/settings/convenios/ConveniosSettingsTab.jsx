import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card.jsx';
import useMediaQuery from '@/hooks/use-media-query.js';
import AgreementImportDialog from './AgreementImportDialog.tsx';
import AgreementDetailSheet from './AgreementDetailSheet.jsx';
import AgreementListPanel from './AgreementListPanel.jsx';
import GovernanceControls from './GovernanceControls.jsx';
import useAgreementSelection from './useAgreementSelection.ts';
import useConvenioSettingsController from '@/features/agreements/useConvenioSettingsController.ts';
import emitAgreementsTelemetry from '@/features/agreements/utils/telemetry.ts';

const ConveniosSettingsTab = () => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [importOpen, setImportOpen] = useState(false);

  const {
    state: {
      role,
      requireApproval,
      locked,
      convenios,
      selected,
      isLoading,
      isFetching,
      error,
      selectedProviderId,
      isSyncingProvider,
      isCreating,
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
      cancelPending,
    },
    helpers: { mutation: importMutation },
  } = useConvenioSettingsController();

  const { sheetOpen, setDetailsOpen, selectAgreement, createAgreement } = useAgreementSelection({
    selectedId: selected?.id ?? null,
    isDesktop,
  });

  const handleSelectConvenio = useCallback(
    (convenioId) => {
      selectAgreement(convenioId, selectConvenio);
    },
    [selectAgreement, selectConvenio]
  );

  const handleCreateConvenio = useCallback(async () => {
    await createAgreement(createConvenio);
  }, [createAgreement, createConvenio]);

  const handleDetailsChange = useCallback(
    (value) => {
      if (!value) {
        cancelPending();
      }
      setDetailsOpen(value);
    },
    [cancelPending, setDetailsOpen]
  );

  return (
    <div className="space-y-6">
      <Card>
        <GovernanceControls
          role={role}
          onRoleChange={setRole}
          requireApproval={requireApproval}
          onRequireApprovalChange={setRequireApproval}
        />
        <AgreementListPanel
          error={error}
          onRetry={refresh}
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
      </Card>
      <AgreementDetailSheet
        open={sheetOpen}
        onOpenChange={handleDetailsChange}
        selected={selected}
        isDesktop={isDesktop}
        requireApproval={requireApproval}
        role={role}
        locked={locked}
        selectedProviderId={selectedProviderId}
        isSyncing={isSyncingProvider}
        onSync={syncProvider}
        onUpdateBasic={updateBasic}
        onUpsertWindow={upsertWindow}
        onRemoveWindow={removeWindow}
        onUpsertTax={upsertTax}
        isCreating={isCreating}
      />
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
