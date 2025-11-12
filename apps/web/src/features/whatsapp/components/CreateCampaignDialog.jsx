import { useCallback, useEffect, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';

import CreateCampaignWizard from './CreateCampaignWizard.jsx';

const CreateCampaignDialog = ({
  open,
  onOpenChange,
  agreement,
  instances,
  defaultInstanceId,
  onSubmit,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmittingChange = useCallback((value) => {
    setIsSubmitting(Boolean(value));
  }, []);

  const handleDialogChange = useCallback(
    (nextOpen) => {
      if (isSubmitting) {
        return;
      }
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
    if (isSubmitting) {
      return;
    }
    onOpenChange?.(false);
  }, [isSubmitting, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nova campanha do WhatsApp</DialogTitle>
          <DialogDescription>
            Configure a campanha em etapas rápidas: selecione a instância conectada, escolha a origem comercial, defina produto, margem e estratégia antes de revisar.
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
        />
      </DialogContent>
    </Dialog>
  );
};

export default CreateCampaignDialog;
