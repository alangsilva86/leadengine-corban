
import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CalendarCheck,
  CalendarPlus,
  CalendarX2,
  ClipboardList,
  FileText,
  Filter,
  LineChart,
  Pencil,
  Plus,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet.jsx';
import { buildConvenioCatalog } from '@/features/agreements/data/convenioCatalog.js';
import {
  computeWindowStatus,
  formatCurrency,
  formatPercent,
  hasDateOverlap,
  simulateConvenioDeal,
} from '@/features/agreements/utils/dailyCoefficient.js';
import { cn } from '@/lib/utils.js';
import useMediaQuery from '@/hooks/use-media-query.js';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Gestor / Admin' },
  { value: 'coordinator', label: 'Coordenador' },
  { value: 'seller', label: 'Vendedor (só leitura)' },
];

const STATUS_OPTIONS = [
  { value: 'EM_IMPLANTACAO', label: 'Em implantação' },
  { value: 'ATIVO', label: 'Ativo' },
  { value: 'PAUSADO', label: 'Pausado' },
  { value: 'ENCERRADO', label: 'Encerrado' },
];

const TYPE_OPTIONS = [
  { value: 'MUNICIPAL', label: 'Municipal' },
  { value: 'ESTADUAL', label: 'Estadual' },
  { value: 'FEDERAL', label: 'Federal' },
];

const PRODUCT_OPTIONS = [
  'Cartão benefício – Saque',
  'Cartão benefício – Compra',
  'Consignado tradicional',
  'Outros',
];

const MODALITIES = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'FLEX1', label: 'Flex 1' },
  { value: 'FLEX2', label: 'Flex 2' },
];

const formatDate = (value) =>
  value.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const toInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const generateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`;

const ConvenioList = ({ convenios, selectedId, onSelect, onArchive, readOnly, onCreate }) => (
  <Card className="border-dashed border-border/60">
    <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <CardTitle>Convênios cadastrados</CardTitle>
        <CardDescription>
          Mantenha convênios, produtos e status alinhados com o que o vendedor entende. Arquivar preserva histórico.
        </CardDescription>
      </div>
      <Button type="button" onClick={onCreate} disabled={readOnly}>
        <Plus className="mr-2 h-4 w-4" /> Novo convênio
      </Button>
    </CardHeader>
    <CardContent className="overflow-hidden p-0">
      <ScrollArea className="max-h-[420px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Convênio</TableHead>
              <TableHead>Averbadora</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Produtos habilitados</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {convenios.map((item) => (
              <TableRow
                key={item.id}
                role="button"
                tabIndex={0}
                aria-selected={item.id === selectedId}
                onClick={() => onSelect(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(item.id);
                  }
                }}
                className={cn(
                  'cursor-pointer transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  item.id === selectedId ? 'bg-muted/40' : 'hover:bg-muted/30'
                )}
              >
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-1">
                    <span>{item.nome}</span>
                    <span className="text-xs text-muted-foreground">Responsável: {item.responsavel || '—'}</span>
                  </div>
                </TableCell>
                <TableCell>{item.averbadora || '—'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.status === 'ATIVO' ? 'default' : 'secondary'}>
                      {STATUS_OPTIONS.find((option) => option.value === item.status)?.label ?? item.status}
                    </Badge>
                    {item.archived ? <Badge variant="outline">Arquivado</Badge> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {item.produtos.length === 0
                      ? '—'
                      : item.produtos.map((produto) => (
                          <Badge key={produto} variant="outline">
                            {produto}
                          </Badge>
                        ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      onArchive(item.id);
                    }}
                    disabled={readOnly}
                  >
                    <Archive className="mr-1 h-4 w-4" /> Arquivar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {convenios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  Cadastre o primeiro convênio para liberar simulações.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </ScrollArea>
    </CardContent>
  </Card>
);

const BasicInformation = ({ convenio, onSave, disabled }) => {
  const [form, setForm] = useState({
    nome: convenio?.nome ?? '',
    averbadora: convenio?.averbadora ?? '',
    tipo: convenio?.tipo ?? 'MUNICIPAL',
    status: convenio?.status ?? 'EM_IMPLANTACAO',
    produtos: convenio?.produtos ?? [],
    responsavel: convenio?.responsavel ?? '',
    observacoes: '',
  });

  useEffect(() => {
    setForm({
      nome: convenio?.nome ?? '',
      averbadora: convenio?.averbadora ?? '',
      tipo: convenio?.tipo ?? 'MUNICIPAL',
      status: convenio?.status ?? 'EM_IMPLANTACAO',
      produtos: convenio?.produtos ?? [],
      responsavel: convenio?.responsavel ?? '',
      observacoes: '',
    });
  }, [convenio]);

  const toggleProduto = (produto) => {
    setForm((current) => ({
      ...current,
      produtos: current.produtos.includes(produto)
        ? current.produtos.filter((item) => item !== produto)
        : [...current.produtos, produto],
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave?.({
      nome: form.nome.trim(),
      averbadora: form.averbadora.trim(),
      tipo: form.tipo,
      status: form.status,
      produtos: form.produtos,
      responsavel: form.responsavel.trim(),
    });
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
            <Button type="submit" disabled={disabled}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Salvar dados básicos
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const WindowDialog = ({ open, onClose, onSubmit, initialValue, windows, disabled }) => {
  const [form, setForm] = useState(() => ({
    id: initialValue?.id ?? null,
    label: initialValue?.label ?? '',
    start: initialValue ? toInputValue(initialValue.start) : '',
    end: initialValue ? toInputValue(initialValue.end) : '',
    firstDueDate: initialValue ? toInputValue(initialValue.firstDueDate) : '',
  }));
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm({
      id: initialValue?.id ?? null,
      label: initialValue?.label ?? '',
      start: initialValue ? toInputValue(initialValue.start) : '',
      end: initialValue ? toInputValue(initialValue.end) : '',
      firstDueDate: initialValue ? toInputValue(initialValue.firstDueDate) : '',
    });
    setError(null);
  }, [initialValue, open]);

  const handleSubmit = (event) => {
    event.preventDefault();

    const start = form.start ? parseDate(form.start) : null;
    const end = form.end ? parseDate(form.end) : null;
    const firstDueDate = form.firstDueDate ? parseDate(form.firstDueDate) : null;

    if (!start || !end || !firstDueDate) {
      setError('Preencha todas as datas.');
      return;
    }

    if (end < start) {
      setError('Último dia deve ser maior que o primeiro.');
      return;
    }

    if (firstDueDate <= end) {
      setError('1º vencimento precisa ser posterior ao fim da janela.');
      return;
    }

    const candidate = { start, end, firstDueDate };
    const other = windows.filter((window) => window.id !== form.id);
    if (hasDateOverlap(other, candidate)) {
      setError('Existe sobreposição com outra janela.');
      return;
    }

    onSubmit({
      id: form.id ?? generateId(),
      label: form.label || 'Janela',
      ...candidate,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar janela' : 'Nova janela de contratação'}</DialogTitle>
            <DialogDescription>Cadastre o intervalo em que o banco aceita contratos e o 1º vencimento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="window-label">Nome da janela (opcional)</Label>
            <Input
              id="window-label"
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              disabled={disabled}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>1º dia</Label>
              <Input
                type="date"
                value={form.start}
                onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))}
                required
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Último dia</Label>
              <Input
                type="date"
                value={form.end}
                onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))}
                required
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>1º vencimento</Label>
              <Input
                type="date"
                value={form.firstDueDate}
                onChange={(event) => setForm((current) => ({ ...current, firstDueDate: event.target.value }))}
                required
                disabled={disabled}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={disabled}>
              <CalendarCheck className="mr-2 h-4 w-4" /> Salvar janela
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const CalendarCard = ({ convenio, onUpsert, onRemove, readOnly }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const sorted = useMemo(
    () => [...(convenio?.janelas ?? [])].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [convenio?.janelas]
  );

  const active = sorted.some((window) => computeWindowStatus(window) === 'Ativa');

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Calendário de contratação</CardTitle>
          <CardDescription>Sem janela ativa não tem simulação. Traga o vocabulário do vendedor.</CardDescription>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          disabled={readOnly}
        >
          <CalendarPlus className="mr-2 h-4 w-4" /> Nova janela
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>Janela</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>1º vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Cadastre ao menos uma janela para liberar simulações.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((window) => {
                  const status = computeWindowStatus(window);
                  const statusVariant = status === 'Ativa' ? 'default' : status === 'Futura' ? 'secondary' : 'outline';

                  return (
                    <TableRow key={window.id}>
                      <TableCell className="font-medium">{window.label}</TableCell>
                      <TableCell>
                        {formatDate(window.start)} até {formatDate(window.end)}
                      </TableCell>
                      <TableCell>{formatDate(window.firstDueDate)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant}>{status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(window);
                              setDialogOpen(true);
                            }}
                            disabled={readOnly}
                          >
                            <Pencil className="mr-1 h-4 w-4" /> Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onRemove(window.id)}
                            disabled={readOnly}
                          >
                            <CalendarX2 className="mr-1 h-4 w-4" /> Encerrar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {!active ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
            Atenção: sem janela ativa o simulador bloqueia novos cálculos.
          </div>
        ) : null}
      </CardContent>
      <WindowDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={onUpsert}
        initialValue={editing}
        windows={sorted}
        disabled={readOnly}
      />
    </Card>
  );
};

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

const TaxesCard = ({ convenio, onUpsert, readOnly }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [product, setProduct] = useState(() => convenio?.produtos?.[0] ?? PRODUCT_OPTIONS[0]);

  useEffect(() => {
    if (!convenio) {
      return;
    }
    if (convenio.produtos.includes(product)) {
      return;
    }
    setProduct(convenio.produtos[0] ?? PRODUCT_OPTIONS[0]);
  }, [convenio, product]);

  const taxes = useMemo(
    () => (convenio?.taxas ?? []).filter((tax) => tax.produto === product),
    [convenio?.taxas, product]
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Tabela de taxas</CardTitle>
          <CardDescription>Nenhum campo técnico: só taxa, TAC e vigência.</CardDescription>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" /> Produto
          </div>
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger className="w-full min-w-[200px] md:w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(convenio?.produtos.length ? convenio.produtos : PRODUCT_OPTIONS).map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            disabled={readOnly}
          >
            <LineChart className="mr-2 h-4 w-4" /> Nova taxa
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead>Modalidade</TableHead>
                <TableHead>Taxa ao mês</TableHead>
                <TableHead>TAC</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Nenhuma taxa cadastrada para este produto.
                  </TableCell>
                </TableRow>
              ) : (
                taxes.map((tax) => (
                  <TableRow key={tax.id}>
                    <TableCell className="font-medium">
                      {MODALITIES.find((item) => item.value === tax.modalidade)?.label ?? tax.modalidade}
                    </TableCell>
                    <TableCell>{formatPercent(tax.monthlyRate)}</TableCell>
                    <TableCell>
                      {tax.tacPercent ? `${formatPercent(tax.tacPercent)} ` : ''}
                      {tax.tacFlat ? `+ ${formatCurrency(tax.tacFlat)}` : tax.tacPercent ? null : '—'}
                    </TableCell>
                    <TableCell>
                      Desde {formatDate(tax.validFrom)}
                      {tax.validUntil ? ` até ${formatDate(tax.validUntil)}` : ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tax.status === 'Ativa' ? 'default' : 'secondary'}>{tax.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(tax);
                          setDialogOpen(true);
                        }}
                        disabled={readOnly}
                      >
                        <Pencil className="mr-1 h-4 w-4" /> Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 rounded-md border border-muted-foreground/20 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Alterar a taxa afeta só simulações futuras. Contratos já liberados não mudam.
        </div>
      </CardContent>
      <TaxDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={onUpsert}
        initialValue={editing}
        disabled={readOnly}
      />
    </Card>
  );
};

const SimulationPreview = ({ convenio }) => {
  const [form, setForm] = useState(() => ({
    produto: convenio?.produtos?.[0] ?? PRODUCT_OPTIONS[0],
    modalidade: 'NORMAL',
    margem: 350,
    prazoMeses: 84,
    dataSimulacao: toInputValue(new Date()),
  }));

  useEffect(() => {
    setForm((current) => ({
      ...current,
      produto: convenio?.produtos.includes(current.produto) ? current.produto : convenio?.produtos[0] ?? PRODUCT_OPTIONS[0],
    }));
  }, [convenio]);

  const preview = useMemo(() => {
    if (!convenio) {
      return { type: 'empty' };
    }

    const data = parseDate(form.dataSimulacao);
    const janela = (convenio.janelas ?? []).find((window) => data >= window.start && data <= window.end);
    const taxa = (convenio.taxas ?? [])
      .filter((item) => item.produto === form.produto && item.modalidade === form.modalidade)
      .find((item) => data >= item.validFrom && (!item.validUntil || data <= item.validUntil));

    if (!janela) {
      return { type: 'warning', message: 'Convênio sem janela vigente para esta data.' };
    }

    if (!taxa) {
      return { type: 'warning', message: 'Cadastre a taxa para esta modalidade antes de simular.' };
    }

    const simulation = simulateConvenioDeal({
      margem: Number(form.margem),
      prazoMeses: Number(form.prazoMeses),
      dataSimulacao: data,
      janela,
      taxa,
    });

    return { type: 'success', simulation };
  }, [convenio, form]);

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
                {(convenio?.produtos.length ? convenio.produtos : PRODUCT_OPTIONS).map((item) => (
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

const HistoryCard = ({ history }) => (
  <Card>
    <CardHeader>
      <CardTitle>Histórico de alterações</CardTitle>
      <CardDescription>Auditoria com responsável, o que mudou e quando.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {history.length === 0 ? (
        <div className="rounded-md border border-border px-4 py-3 text-sm text-muted-foreground">
          Assim que taxas ou janelas forem atualizadas elas aparecem aqui.
        </div>
      ) : (
        history
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/40 p-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">{entry.message}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.author} · {entry.createdAt.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          ))
      )}
    </CardContent>
  </Card>
);

const ConvenioDetails = ({ convenio, onUpdateBasic, onUpsertWindow, onRemoveWindow, onUpsertTax, readOnly }) => {
  if (!convenio) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
        Selecione um convênio para editar dados, calendário e taxas.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BasicInformation convenio={convenio} onSave={onUpdateBasic} disabled={readOnly} />
      <CalendarCard convenio={convenio} onUpsert={onUpsertWindow} onRemove={onRemoveWindow} readOnly={readOnly} />
      <TaxesCard convenio={convenio} onUpsert={onUpsertTax} readOnly={readOnly} />
      <SimulationPreview convenio={convenio} />
      <HistoryCard history={convenio.history ?? []} />
    </div>
  );
};

const ConveniosSettingsTab = () => {
  const [role, setRole] = useState('admin');
  const [requireApproval, setRequireApproval] = useState(true);
  const [convenios, setConvenios] = useState(() => buildConvenioCatalog());
  const [selectedId, setSelectedId] = useState(() => (convenios[0]?.id ?? null));
  const [detailsOpen, setDetailsOpen] = useState(false);

  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const readOnly = role === 'seller';
  const selected = useMemo(() => convenios.find((item) => item.id === selectedId) ?? null, [convenios, selectedId]);

  useEffect(() => {
    if (isDesktop) {
      setDetailsOpen(true);
      return;
    }

    setDetailsOpen(false);
  }, [isDesktop]);

  const addHistory = (convenioId, message) => {
    setConvenios((current) =>
      current.map((convenio) =>
        convenio.id === convenioId
          ? {
              ...convenio,
              history: [
                {
                  id: generateId(),
                  author: role === 'seller' ? 'Sugestão do vendedor' : role === 'coordinator' ? 'Coordenador' : 'Admin',
                  message,
                  createdAt: new Date(),
                },
                ...(convenio.history ?? []),
              ],
            }
          : convenio
      )
    );
  };

  const updateConvenio = (convenioId, updater) => {
    setConvenios((current) => current.map((convenio) => (convenio.id === convenioId ? updater(convenio) : convenio)));
  };

  const handleUpdateBasic = (payload) => {
    if (!selected) {
      return;
    }

    updateConvenio(selected.id, (convenio) => ({
      ...convenio,
      ...payload,
    }));

    addHistory(
      selected.id,
      `Dados básicos atualizados: ${payload.nome} (${STATUS_OPTIONS.find((item) => item.value === payload.status)?.label ?? payload.status}).`
    );
  };

  const handleUpsertWindow = (payload) => {
    if (!selected) {
      return;
    }

    updateConvenio(selected.id, (convenio) => {
      const exists = convenio.janelas.some((window) => window.id === payload.id);
      const janelas = exists
        ? convenio.janelas.map((window) => (window.id === payload.id ? payload : window))
        : [...convenio.janelas, payload];
      return { ...convenio, janelas };
    });

    addHistory(
      selected.id,
      `Janela ${payload.label} ${selected.janelas.some((window) => window.id === payload.id) ? 'atualizada' : 'cadastrada'} (${formatDate(payload.start)} até ${formatDate(payload.end)}).`
    );
  };

  const handleRemoveWindow = (windowId) => {
    if (!selected) {
      return;
    }

    updateConvenio(selected.id, (convenio) => ({
      ...convenio,
      janelas: convenio.janelas.filter((window) => window.id !== windowId),
    }));

    addHistory(selected.id, 'Janela removida do calendário.');
  };

  const handleUpsertTax = (payload) => {
    if (!selected) {
      return;
    }

    updateConvenio(selected.id, (convenio) => {
      const exists = convenio.taxas.some((tax) => tax.id === payload.id);
      const taxas = exists
        ? convenio.taxas.map((tax) => (tax.id === payload.id ? payload : tax))
        : [...convenio.taxas, payload];
      return { ...convenio, taxas };
    });

    addHistory(
      selected.id,
      `${payload.modalidade} atualizado para ${formatPercent(payload.monthlyRate)} (${payload.produto}).`
    );
  };

  const handleArchive = (convenioId) => {
    setConvenios((current) =>
      current.map((convenio) =>
        convenio.id === convenioId
          ? {
              ...convenio,
              archived: true,
              status: convenio.status === 'ATIVO' ? 'PAUSADO' : convenio.status,
            }
          : convenio
      )
    );
  };

  const handleCreateConvenio = () => {
    const convenio = {
      id: generateId(),
      nome: 'Novo convênio',
      averbadora: '',
      tipo: 'MUNICIPAL',
      status: 'EM_IMPLANTACAO',
      produtos: [],
      responsavel: '',
      archived: false,
      janelas: [],
      taxas: [],
      history: [
        {
          id: generateId(),
          author: 'Admin',
          message: 'Convênio criado. Complete dados básicos e tabelas.',
          createdAt: new Date(),
        },
      ],
    };

    setConvenios((current) => [convenio, ...current]);
    setSelectedId(convenio.id);
    setDetailsOpen(true);
  };

  const handleSelectConvenio = (convenioId) => {
    setSelectedId(convenioId);
    setDetailsOpen(true);
  };

  const sheetOpen = detailsOpen && Boolean(selected);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <CardTitle>Convênios &amp; Tabelas</CardTitle>
            <CardDescription>
              Gestão comercial sem falar em coeficiente. Configure convênios, janelas e taxas e deixe o motor calcular.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCircle className="h-4 w-4" /> Perfil
            </div>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full min-w-[200px] md:w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
              Exigir aprovação para publicar alterações
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <ConvenioList
            convenios={convenios}
            selectedId={selectedId}
            onSelect={handleSelectConvenio}
            onArchive={handleArchive}
            readOnly={readOnly}
            onCreate={handleCreateConvenio}
          />
          <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Governança</p>
            <p>
              Gestores editam diretamente. Coordenadores podem exigir aprovação antes de publicar. Vendedores enxergam tudo e usam nas simulações, mas não mexem nas tabelas.
            </p>
          </div>
        </CardContent>
      </Card>
      <Sheet open={sheetOpen} onOpenChange={setDetailsOpen}>
        {selected ? (
          <SheetContent
            side={isDesktop ? 'right' : 'bottom'}
            className={cn(
              'flex w-full flex-col gap-4',
              isDesktop ? 'h-full sm:max-w-xl lg:max-w-3xl' : 'h-[85vh] max-w-none'
            )}
          >
            <SheetHeader className="border-b border-border/60 pb-4">
              <SheetTitle className="text-base font-semibold">{selected.nome}</SheetTitle>
              <SheetDescription>
                Averbadora: {selected.averbadora || '—'} · {STATUS_OPTIONS.find((item) => item.value === selected.status)?.label ?? selected.status}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 overflow-y-auto px-4 pb-6">
              {selected.archived ? (
                <Badge variant="outline" className="border-amber-500 text-amber-600">
                  Arquivado — permanece no histórico, mas não aparece para novas simulações
                </Badge>
              ) : null}
              {requireApproval && role === 'coordinator' ? (
                <Badge variant="secondary" className="text-xs">
                  Alterações enviadas aguardam aprovação do gestor
                </Badge>
              ) : null}
              <ConvenioDetails
                convenio={selected}
                onUpdateBasic={handleUpdateBasic}
                onUpsertWindow={handleUpsertWindow}
                onRemoveWindow={handleRemoveWindow}
                onUpsertTax={handleUpsertTax}
                readOnly={readOnly || (requireApproval && role === 'coordinator')}
              />
            </div>
          </SheetContent>
        ) : null}
      </Sheet>
    </div>
  );
};

export default ConveniosSettingsTab;
