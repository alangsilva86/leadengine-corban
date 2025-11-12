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
        <DialogContent className="w-full max-h-[85vh] max-w-[780px] overflow-hidden rounded-2xl border border-border bg-background p-0">
          <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-5">
            <DialogTitle className="text-lg font-semibold leading-6">Nova campanha do WhatsApp</DialogTitle>
            <DialogDescription className="text-sm leading-5 text-muted-foreground">
              Configure a campanha em cinco passos: instância conectada, origem, produto, estratégia e revisão final.
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
