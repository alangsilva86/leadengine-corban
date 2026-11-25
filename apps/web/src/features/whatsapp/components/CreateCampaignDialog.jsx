import { useCallback, useEffect, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';

import CreateCampaignWizard, { STEP_SEQUENCE, TOTAL_STEPS } from './CreateCampaignWizard.jsx';

/** Diálogo da "Nova regra de roteamento": hospeda o assistente e bloqueia o fechamento durante o envio. */
const CreateCampaignDialog = ({ open, onOpenChange, agreement, instances, defaultInstanceId, onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      setActiveStepIndex(0);
    }
  }, [open]);

  const handleSubmittingChange = useCallback((value) => setIsSubmitting(Boolean(value)), []);

  const handleDialogChange = useCallback(
    (nextOpen) => {
      if (isSubmitting) return;
      onOpenChange?.(nextOpen);
    },
    [isSubmitting, onOpenChange],
  );

  const handleSubmit = useCallback(
    async (payload) => {
      await onSubmit?.(payload);
      onOpenChange?.(false);
    },
    [onSubmit, onOpenChange],
  );

  const handleCancel = useCallback(() => {
    if (!isSubmitting) onOpenChange?.(false);
  }, [isSubmitting, onOpenChange]);

  const handleStepChange = useCallback((payload) => {
    if (payload) setActiveStepIndex(payload.index ?? 0);
  }, []);

  const step = STEP_SEQUENCE[Math.min(activeStepIndex, TOTAL_STEPS - 1)];

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-xl">
        <DialogHeader className="space-y-1 border-b border-border px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="text-lg">Nova regra de roteamento</DialogTitle>
          <DialogDescription>
            Etapa {Math.min(activeStepIndex + 1, TOTAL_STEPS)} de {TOTAL_STEPS} · {step.description}
          </DialogDescription>
        </DialogHeader>
        <CreateCampaignWizard
          open={open}
          agreement={agreement}
          instances={instances}
          defaultInstanceId={defaultInstanceId}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onSubmittingChange={handleSubmittingChange}
          onStepChange={handleStepChange}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CreateCampaignDialog;
