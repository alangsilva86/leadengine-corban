import { useEffect, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';

/** Renomear regra (a API aceita alterar o nome via PATCH). */
const RenameCampaignDialog = ({ campaign, onOpenChange, onSubmit }) => {
  const fieldId = useId();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const open = Boolean(campaign);

  useEffect(() => {
    if (campaign) {
      setName(campaign.name ?? '');
      setSubmitting(false);
    }
  }, [campaign]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== (campaign?.name ?? '').trim() && !submitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit?.(campaign, trimmed);
      onOpenChange?.(false);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (!submitting ? onOpenChange?.(value) : undefined)}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Renomear regra</DialogTitle>
            <DialogDescription>O novo nome aparece para todo o time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={fieldId}>Nome da regra</Label>
            <Input id={fieldId} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RenameCampaignDialog;
