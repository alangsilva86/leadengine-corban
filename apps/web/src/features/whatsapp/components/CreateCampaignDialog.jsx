import { useCallback, useEffect, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Badge } from '@/components/ui/badge.jsx';

import CreateCampaignWizard, { STEP_SEQUENCE, TOTAL_STEPS } from './CreateCampaignWizard.jsx';

const resolveInstanceLabel = (instance) => {
  if (!instance) {
    return 'Instância WhatsApp';
  }

  const candidates = [instance.name, instance.displayName, instance.id];
  const label = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return label ? label.trim() : 'Instância WhatsApp';
};

const CreateCampaignDialog = ({
  open,
  onOpenChange,
  agreement,
  instances,
  defaultInstanceId,
  onSubmit,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [selectionSummary, setSelectionSummary] = useState({ instance: null, agreement: null, product: null, strategy: null });

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      setActiveStepIndex(0);
      setSelectionSummary({ instance: null, agreement: null, product: null, strategy: null });
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

  const handleStepChange = useCallback((payload) => {
    if (!payload) return;
    setActiveStepIndex(payload.index ?? 0);
  }, []);

  const handleSelectionChange = useCallback((payload) => {
    if (!payload) return;
    setSelectionSummary(payload);
  }, []);

  const currentInstanceLabel = resolveInstanceLabel(selectionSummary.instance);
  const instanceStatusBadge = selectionSummary.instance
    ? selectionSummary.instance.connected
      ? { label: 'Conectada', tone: 'success' }
      : { label: 'Pendente', tone: 'warning' }
    : null;

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="w-[95vw] max-h-[85vh] min-h-0 overflow-y-auto rounded-2xl border border-border bg-background p-0 md:w-[85vw] md:max-w-[75vw] lg:max-w-[1200px]">
        <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-5">
          <DialogTitle className="text-lg font-semibold leading-6">Nova campanha do WhatsApp</DialogTitle>
          <DialogDescription className="text-sm leading-5 text-muted-foreground">
            Configure a campanha em cinco passos: instância conectada, origem, produto, estratégia e revisão final.
          </DialogDescription>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="border-border/60 bg-muted/10 uppercase tracking-wide">
              Passo {Math.min(activeStepIndex + 1, STEP_SEQUENCE.length)} de {STEP_SEQUENCE.length}
            </Badge>
            <span>Campanhas conectam Instâncias (Passo 1) à Inbox (Passo {TOTAL_STEPS}).</span>
          </div>
          {selectionSummary.instance ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="uppercase tracking-wide">Instância ativa:</span>
              <span className="text-sm font-semibold text-foreground">{currentInstanceLabel}</span>
              {instanceStatusBadge ? (
                <Badge
                  variant={instanceStatusBadge.tone === 'success' ? 'secondary' : 'outline'}
                  className={instanceStatusBadge.tone === 'success'
                    ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-400/60 bg-amber-500/10 text-amber-200'}
                >
                  {instanceStatusBadge.label}
                </Badge>
              ) : null}
            </div>
          ) : null}
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
          onSelectionChange={handleSelectionChange}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CreateCampaignDialog;
