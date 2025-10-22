import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Button } from '@/components/ui/button.jsx';

const DEFAULT_OUTCOME = 'connected';

const CallResultDialog = ({ open, onOpenChange, onSubmit }) => {
  const [outcome, setOutcome] = useState(DEFAULT_OUTCOME);
  const [notes, setNotes] = useState('');
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setOutcome(DEFAULT_OUTCOME);
      setNotes('');
      return;
    }

    const frame = requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  const handleSubmit = () => {
    onSubmit?.({ outcome, notes });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar resultado da chamada</DialogTitle>
          <DialogDescription>
            Informe o status e anote qualquer observação relevante antes de voltar para o chat.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="call-outcome" className="text-sm font-medium text-foreground">
            Resultado
          </Label>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger id="call-outcome" className="h-10" ref={triggerRef}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="connected">Conectou</SelectItem>
              <SelectItem value="no_answer">Sem resposta</SelectItem>
              <SelectItem value="voicemail">Caixa postal</SelectItem>
            </SelectContent>
          </Select>
          <Label htmlFor="call-notes" className="text-sm font-medium text-foreground">
            Observações
          </Label>
          <Textarea
            id="call-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Resumo do contato"
            className="min-h-[100px]"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CallResultDialog;
