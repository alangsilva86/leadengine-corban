import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { MODALITIES, PRODUCT_OPTIONS } from '@/features/agreements/convenioSettings.constants.ts';
import { generateId, parseDate, toInputValue } from '@/features/agreements/convenioSettings.utils.ts';

const TaxDialog = ({ open, onClose, onSubmit, initialValue, disabled }) => {
  const [form, setForm] = useState(() => ({
    id: initialValue?.id ?? null,
    produto: initialValue?.produto ?? PRODUCT_OPTIONS[0],
    modalidade: initialValue?.modalidade ?? 'NORMAL',
    monthlyRate: initialValue?.monthlyRate ? String(initialValue.monthlyRate) : '',
    tacPercent: initialValue?.tacPercent ? String(initialValue.tacPercent) : '',
    tacFlat: initialValue?.tacFlat ? String(initialValue.tacFlat) : '',
    validFrom: initialValue?.validFrom ? toInputValue(initialValue.validFrom) : '',
    validUntil: initialValue?.validUntil ? toInputValue(initialValue.validUntil) : '',
  }));
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm({
      id: initialValue?.id ?? null,
      produto: initialValue?.produto ?? PRODUCT_OPTIONS[0],
      modalidade: initialValue?.modalidade ?? 'NORMAL',
      monthlyRate: initialValue?.monthlyRate ? String(initialValue.monthlyRate) : '',
      tacPercent: initialValue?.tacPercent ? String(initialValue.tacPercent) : '',
      tacFlat: initialValue?.tacFlat ? String(initialValue.tacFlat) : '',
      validFrom: initialValue?.validFrom ? toInputValue(initialValue.validFrom) : '',
      validUntil: initialValue?.validUntil ? toInputValue(initialValue.validUntil) : '',
    });
    setError(null);
  }, [initialValue, open]);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.monthlyRate) {
      setError('Informe a taxa ao mês.');
      return;
    }

    if (!form.validFrom) {
      setError('Defina a vigência inicial.');
      return;
    }

    const start = parseDate(form.validFrom);
    const end = form.validUntil ? parseDate(form.validUntil) : null;

    if (end && end < start) {
      setError('Vigência final precisa ser maior que a inicial.');
      return;
    }

    onSubmit({
      id: form.id ?? generateId(),
      produto: form.produto,
      modalidade: form.modalidade,
      monthlyRate: Number(form.monthlyRate),
      tacPercent: form.tacPercent ? Number(form.tacPercent) : 0,
      tacFlat: form.tacFlat ? Number(form.tacFlat) : 0,
      validFrom: start,
      validUntil: end,
      status: 'Ativa',
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar taxa' : 'Nova taxa do convênio'}</DialogTitle>
            <DialogDescription>Taxa, TAC e vigência: é tudo que o vendedor precisa para simular.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={form.produto} onValueChange={(value) => setForm((current) => ({ ...current, produto: value }))} disabled={disabled}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_OPTIONS.map((produto) => (
                    <SelectItem key={produto} value={produto}>
                      {produto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modalidade</Label>
              <Select value={form.modalidade} onValueChange={(value) => setForm((current) => ({ ...current, modalidade: value }))} disabled={disabled}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODALITIES.map((modalidade) => (
                    <SelectItem key={modalidade.value} value={modalidade.value}>
                      {modalidade.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="taxa">Taxa ao mês (%)</Label>
              <Input
                id="taxa"
                type="number"
                step="0.01"
                value={form.monthlyRate}
                onChange={(event) => setForm((current) => ({ ...current, monthlyRate: event.target.value }))}
                required
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tac-percent">TAC (%)</Label>
              <Input
                id="tac-percent"
                type="number"
                step="0.01"
                value={form.tacPercent}
                onChange={(event) => setForm((current) => ({ ...current, tacPercent: event.target.value }))}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tac-flat">TAC (valor fixo)</Label>
              <Input
                id="tac-flat"
                type="number"
                step="0.01"
                value={form.tacFlat}
                onChange={(event) => setForm((current) => ({ ...current, tacFlat: event.target.value }))}
                disabled={disabled}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Vigente a partir de</Label>
              <Input
                type="date"
                value={form.validFrom}
                onChange={(event) => setForm((current) => ({ ...current, validFrom: event.target.value }))}
                required
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Vigente até (opcional)</Label>
              <Input
                type="date"
                value={form.validUntil}
                onChange={(event) => setForm((current) => ({ ...current, validUntil: event.target.value }))}
                disabled={disabled}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={disabled}>
              <FileText className="mr-2 h-4 w-4" /> Salvar taxa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaxDialog;
