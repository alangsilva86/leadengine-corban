import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx';
import { Button } from '@/components/ui/button.jsx';

import { fetchCampaigns } from '../../connect/services/campaignService';
import type { WhatsAppNumber } from '../../hooks/useWhatsAppNumbers';

export type RemoveMode = 'delete' | 'disconnect';

interface RemoveNumberDialogProps {
  number: WhatsAppNumber | null;
  mode: RemoveMode;
  onOpenChange: (open: boolean) => void;
  onConfirm: (number: WhatsAppNumber, mode: RemoveMode) => Promise<void>;
}

/** Confirmação para desconectar ou excluir um número, listando o que acontece em seguida. */
const RemoveNumberDialog = ({ number, mode, onOpenChange, onConfirm }: RemoveNumberDialogProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [linkedCampaigns, setLinkedCampaigns] = useState<number | null>(null);
  const open = Boolean(number);

  // Quantas regras ativas usam este número (para deixar a consequência concreta).
  useEffect(() => {
    if (!number || number.isSessionOnly) {
      setLinkedCampaigns(null);
      return undefined;
    }
    let cancelled = false;
    fetchCampaigns({ agreementId: null, instanceId: number.id })
      .then((items) => {
        if (!cancelled) setLinkedCampaigns(items.length);
      })
      .catch(() => {
        if (!cancelled) setLinkedCampaigns(null);
      });
    return () => {
      cancelled = true;
    };
  }, [number]);

  useEffect(() => {
    if (!open) setSubmitting(false);
  }, [open]);

  if (!number) {
    return null;
  }

  const isDelete = mode === 'delete';
  const campaignsLine =
    linkedCampaigns && linkedCampaigns > 0
      ? `${linkedCampaigns} ${linkedCampaigns === 1 ? 'regra ativa usa' : 'regras ativas usam'} este número e ${
          linkedCampaigns === 1 ? 'ficará' : 'ficarão'
        } sem número até você escolher outro.`
      : 'Regras ligadas a este número ficam sem número até você escolher outro.';

  const consequences = isDelete
    ? [
        'O WhatsApp é desconectado do celular.',
        campaignsLine,
        'Para usar este número de novo, será preciso conectá-lo do zero.',
      ]
    : [
        'O WhatsApp é desconectado do celular e novas mensagens deixam de chegar na Inbox.',
        'As regras continuam ligadas ao número e voltam a funcionar quando você reconectar.',
      ];

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(number, mode);
      onOpenChange(false);
    } catch {
      // O erro já foi exibido em um aviso; mantemos o diálogo aberto para nova tentativa.
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(value: boolean) => (!submitting ? onOpenChange(value) : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isDelete ? `Excluir ${number.name}?` : `Desconectar ${number.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{isDelete ? 'Ao excluir este número:' : 'Ao desconectar:'}</p>
              <ul className="list-disc space-y-1.5 pl-5">
                {consequences.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {isDelete ? <p className="font-medium text-foreground">Esta ação não pode ser desfeita.</p> : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={submitting}>
            {submitting ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            {isDelete ? 'Excluir número' : 'Desconectar'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RemoveNumberDialog;
