import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { PRODUCT_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS } from '@/features/agreements/convenioSettings.constants.ts';

const BasicInformation = ({ initialValues, onSave, disabled }) => {
  const [form, setForm] = useState({
    nome: initialValues?.nome ?? '',
    averbadora: initialValues?.averbadora ?? '',
    tipo: initialValues?.tipo ?? 'MUNICIPAL',
    status: initialValues?.status ?? 'EM_IMPLANTACAO',
    produtos: initialValues?.produtos ?? [],
    responsavel: initialValues?.responsavel ?? '',
    observacoes: '',
  });

  useEffect(() => {
    setForm({
      nome: initialValues?.nome ?? '',
      averbadora: initialValues?.averbadora ?? '',
      tipo: initialValues?.tipo ?? 'MUNICIPAL',
      status: initialValues?.status ?? 'EM_IMPLANTACAO',
      produtos: initialValues?.produtos ?? [],
      responsavel: initialValues?.responsavel ?? '',
      observacoes: '',
    });
  }, [initialValues]);

  const toggleProduto = (produto) => {
    setForm((current) => ({
      ...current,
      produtos: current.produtos.includes(produto)
        ? current.produtos.filter((item) => item !== produto)
        : [...current.produtos, produto],
    }));
  };

  const processSave = () => {
    if (disabled) {
      return;
    }
    onSave?.({
      nome: form.nome.trim(),
      averbadora: form.averbadora.trim(),
      tipo: form.tipo,
      status: form.status,
      produtos: form.produtos,
      responsavel: form.responsavel.trim(),
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    processSave();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados básicos</CardTitle>
        <CardDescription>Campos que o vendedor entende. Nada de coeficiente.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome-convenio">Nome do convênio</Label>
              <Input
                id="nome-convenio"
                value={form.nome}
                onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                required
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="averbadora">Averbadora</Label>
              <Input
                id="averbadora"
                value={form.averbadora}
                onChange={(event) => setForm((current) => ({ ...current, averbadora: event.target.value }))}
                required
                disabled={disabled}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(value) => setForm((current) => ({ ...current, tipo: value }))} disabled={disabled}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Situação</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))} disabled={disabled}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável interno</Label>
              <Input
                id="responsavel"
                value={form.responsavel}
                onChange={(event) => setForm((current) => ({ ...current, responsavel: event.target.value }))}
                disabled={disabled}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Produtos habilitados</Label>
            <div className="flex flex-wrap gap-3">
              {PRODUCT_OPTIONS.map((produto) => (
                <label key={produto} className="inline-flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.produtos.includes(produto)}
                    onCheckedChange={() => toggleProduto(produto)}
                    disabled={disabled}
                  />
                  {produto}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="observacoes">Notas internas (opcional)</Label>
            <Textarea
              id="observacoes"
              placeholder="Mensagem para o time comercial"
              value={form.observacoes}
              onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))}
              disabled={disabled}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" onClick={processSave} disabled={disabled}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Salvar dados básicos
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default BasicInformation;
