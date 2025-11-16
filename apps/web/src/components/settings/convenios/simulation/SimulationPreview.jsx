import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { PRODUCT_OPTIONS, MODALITIES } from '@/features/agreements/convenioSettings.constants.ts';
import { parseDate, toInputValue } from '@/features/agreements/convenioSettings.utils.ts';
import { formatCurrency, simulateConvenioDeal } from '@/features/agreements/utils/dailyCoefficient.js';

const SimulationPreview = ({ products, windows, taxes }) => {
  const [form, setForm] = useState(() => ({
    produto: products?.[0] ?? PRODUCT_OPTIONS[0],
    modalidade: 'NORMAL',
    margem: 350,
    prazoMeses: 84,
    dataSimulacao: toInputValue(new Date()),
  }));

  useEffect(() => {
    setForm((current) => ({
      ...current,
      produto: products?.includes(current.produto) ? current.produto : products?.[0] ?? PRODUCT_OPTIONS[0],
    }));
  }, [products]);

  const preview = useMemo(() => {
    const simulationDate = parseDate(form.dataSimulacao);
    const janela = (windows ?? []).find((window) => simulationDate >= window.start && simulationDate <= window.end);
    const taxa = (taxes ?? [])
      .filter((item) => item.produto === form.produto && item.modalidade === form.modalidade)
      .find((item) => simulationDate >= item.validFrom && (!item.validUntil || simulationDate <= item.validUntil));

    if (!janela) {
      return { type: 'warning', message: 'Convênio sem janela vigente para esta data.' };
    }

    if (!taxa) {
      return { type: 'warning', message: 'Cadastre a taxa para esta modalidade antes de simular.' };
    }

    const simulation = simulateConvenioDeal({
      margem: Number(form.margem),
      prazoMeses: Number(form.prazoMeses),
      dataSimulacao: simulationDate,
      janela,
      taxa,
    });

    return { type: 'success', simulation };
  }, [form, taxes, windows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulação de teste</CardTitle>
        <CardDescription>Margem e prazo simples. Resultado retorna coeficiente e valores para o vendedor.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2 sm:col-span-2">
            <Label>Produto</Label>
            <Select value={form.produto} onValueChange={(value) => setForm((current) => ({ ...current, produto: value }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(products?.length ? products : PRODUCT_OPTIONS).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Modalidade</Label>
            <Select value={form.modalidade} onValueChange={(value) => setForm((current) => ({ ...current, modalidade: value }))}>
              <SelectTrigger className="w-full">
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
          <div className="space-y-2">
            <Label>Margem (R$)</Label>
            <Input
              type="number"
              value={form.margem}
              onChange={(event) => setForm((current) => ({ ...current, margem: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Prazo (meses)</Label>
            <Input
              type="number"
              value={form.prazoMeses}
              onChange={(event) => setForm((current) => ({ ...current, prazoMeses: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Data da simulação</Label>
            <Input
              type="date"
              value={form.dataSimulacao}
              onChange={(event) => setForm((current) => ({ ...current, dataSimulacao: event.target.value }))}
            />
          </div>
        </div>
        {preview.type === 'warning' ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
            {preview.message}
          </div>
        ) : null}
        {preview.type === 'success' ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Coeficiente estimado</p>
              <p className="text-xl font-semibold text-primary">{preview.simulation.coefficient.toFixed(4)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Valor liberado</p>
              <p className="text-xl font-semibold">{formatCurrency(preview.simulation.grossAmount)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">TAC</p>
              <p className="text-xl font-semibold">{formatCurrency(preview.simulation.tacValue)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Valor líquido</p>
              <p className="text-xl font-semibold text-emerald-600">{formatCurrency(preview.simulation.netAmount)}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default SimulationPreview;
