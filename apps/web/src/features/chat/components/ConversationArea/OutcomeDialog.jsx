import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { cn } from '@/lib/utils.js';

const DEFAULT_SUCCESS_STATE = {
  installment: '',
  netAmount: '',
  term: '',
  product: '',
  bank: '',
  notes: '',
};

const DEFAULT_LOSS_STATE = {
  reason: '',
  notes: '',
};

const OUTCOME_MODES = [
  { id: 'success', label: 'Negócio ganho' },
  { id: 'loss', label: 'Registrar perda' },
];

const normalizeDecimalInput = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return trimmed;
};

const normalizeIntegerInput = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return trimmed;
};

const normalizeTextInput = (value) => {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : undefined;
};

const OutcomeDialog = ({
  open,
  mode = 'success',
  onModeChange,
  lossOptions = [],
  onConfirmLoss,
  onConfirmSuccess,
  isSubmitting = false,
}) => {
  const [successState, setSuccessState] = useState(DEFAULT_SUCCESS_STATE);
  const [lossState, setLossState] = useState(DEFAULT_LOSS_STATE);
  const [lossSubmitted, setLossSubmitted] = useState(false);
  const successInitialFocusRef = useRef(null);
  const lossInitialFocusRef = useRef(null);

  const activeMode = useMemo(() => {
    if (mode === 'loss' || mode === 'success') {
      return mode;
    }
    return 'success';
  }, [mode]);

  useEffect(() => {
    if (!open) {
      setSuccessState(DEFAULT_SUCCESS_STATE);
      setLossState(DEFAULT_LOSS_STATE);
      setLossSubmitted(false);
      return;
    }

    const focusTarget = activeMode === 'loss' ? lossInitialFocusRef.current : successInitialFocusRef.current;
    const frame = requestAnimationFrame(() => {
      focusTarget?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [open, activeMode]);

  const handleDialogOpenChange = (nextOpen) => {
    if (!nextOpen) {
      onModeChange?.(null);
    }
  };

  const handleSuccessFieldChange = (field) => (event) => {
    const value = event?.target?.value ?? '';
    setSuccessState((prev) => ({ ...prev, [field]: value }));
  };

  const handleLossFieldChange = (field) => (value) => {
    setLossState((prev) => ({ ...prev, [field]: value }));
  };

  const handleLossNotesChange = (event) => {
    const value = event?.target?.value ?? '';
    setLossState((prev) => ({ ...prev, notes: value }));
  };

  const handleConfirmSuccess = (event) => {
    event?.preventDefault();
    onConfirmSuccess?.({
      installment: normalizeDecimalInput(successState.installment),
      netAmount: normalizeDecimalInput(successState.netAmount),
      term: normalizeIntegerInput(successState.term),
      product: normalizeTextInput(successState.product),
      bank: normalizeTextInput(successState.bank),
      notes: normalizeTextInput(successState.notes),
    });
  };

  const handleConfirmLoss = (event) => {
    event?.preventDefault();
    setLossSubmitted(true);
    if (!lossState.reason) {
      return;
    }
    onConfirmLoss?.({
      reason: lossState.reason,
      notes: normalizeTextInput(lossState.notes),
    });
  };

  const renderSuccessForm = () => (
    <form className="space-y-4" onSubmit={handleConfirmSuccess}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="outcome-success-installment">Parcela</Label>
          <Input
            id="outcome-success-installment"
            ref={successInitialFocusRef}
            value={successState.installment}
            onChange={handleSuccessFieldChange('installment')}
            placeholder="Valor da parcela"
            inputMode="decimal"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="outcome-success-net-amount">Valor liberado</Label>
          <Input
            id="outcome-success-net-amount"
            value={successState.netAmount}
            onChange={handleSuccessFieldChange('netAmount')}
            placeholder="Valor líquido"
            inputMode="decimal"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="outcome-success-term">Prazo (meses)</Label>
          <Input
            id="outcome-success-term"
            value={successState.term}
            onChange={handleSuccessFieldChange('term')}
            placeholder="Prazo em meses"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="outcome-success-product">Produto</Label>
          <Input
            id="outcome-success-product"
            value={successState.product}
            onChange={handleSuccessFieldChange('product')}
            placeholder="Produto contratado"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="outcome-success-bank">Banco</Label>
          <Input
            id="outcome-success-bank"
            value={successState.bank}
            onChange={handleSuccessFieldChange('bank')}
            placeholder="Banco parceiro"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="outcome-success-notes">Observações</Label>
        <Textarea
          id="outcome-success-notes"
          value={successState.notes}
          onChange={handleSuccessFieldChange('notes')}
          placeholder="Detalhes adicionais do fechamento"
          className="min-h-[110px]"
        />
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => onModeChange?.(null)}>
          Cancelar
        </Button>
        <Button type="submit" className="min-h-[44px]" disabled={isSubmitting}>
          Registrar sucesso
        </Button>
      </DialogFooter>
    </form>
  );

  const renderLossForm = () => (
    <form className="space-y-4" onSubmit={handleConfirmLoss}>
      <div className="space-y-2">
        <Label htmlFor="outcome-loss-reason">Motivo *</Label>
        <Select
          value={lossState.reason}
          onValueChange={(value) => {
            handleLossFieldChange('reason')(value);
            setLossSubmitted(false);
          }}
        >
          <SelectTrigger id="outcome-loss-reason" className="min-h-[44px]" ref={lossInitialFocusRef}>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {lossOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {lossSubmitted && !lossState.reason ? (
          <p className="text-xs text-status-error-foreground">Selecione um motivo para continuar.</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="outcome-loss-notes">Observações (opcional)</Label>
        <Textarea
          id="outcome-loss-notes"
          value={lossState.notes}
          onChange={handleLossNotesChange}
          placeholder="Detalhe o motivo ou próximos passos"
          className="min-h-[110px]"
        />
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => onModeChange?.(null)}>
          Cancelar
        </Button>
        <Button type="submit" className="min-h-[44px]" disabled={isSubmitting}>
          Registrar perda
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar resultado</DialogTitle>
          <DialogDescription>
            Atualize o status do atendimento para manter o funil sempre confiável.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet p-1 text-sm font-medium">
          <div className="grid grid-cols-2 gap-1">
            {OUTCOME_MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'rounded-full px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  activeMode === item.id
                    ? 'bg-surface-overlay-strong text-foreground shadow-sm'
                    : 'text-foreground-muted hover:text-foreground'
                )}
                onClick={() => {
                  if (item.id !== activeMode) {
                    onModeChange?.(item.id);
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {activeMode === 'loss' ? renderLossForm() : renderSuccessForm()}
      </DialogContent>
    </Dialog>
  );
};

export default OutcomeDialog;
