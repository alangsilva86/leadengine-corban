import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';

const LossReasonDialog = ({
  open,
  onOpenChange,
  options = [],
  onConfirm,
  isSubmitting = false,
}) => {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setReason('');
      setNotes('');
      setSubmitted(false);
      return;
    }

    const frame = requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  const handleConfirm = () => {
    setSubmitted(true);
    if (!reason) {
      return;
    }
    onConfirm?.({ reason, notes });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar perda</DialogTitle>
          <DialogDescription>
            Informe o motivo da perda para manter o funil atualizado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="loss-reason">Motivo *</Label>
            <Select
              value={reason}
              onValueChange={(value) => {
                setReason(value);
                setSubmitted(false);
              }}
            >
              <SelectTrigger id="loss-reason" className="w-full min-h-[44px]" ref={triggerRef}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {submitted && !reason ? (
              <p className="text-xs text-rose-300">Selecione um motivo para continuar.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="loss-notes">Observações (opcional)</Label>
            <Textarea
              id="loss-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Detalhe o motivo ou próximos passos."
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            className="min-h-[44px]"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="min-h-[44px]"
          >
            Registrar perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LossReasonDialog;
