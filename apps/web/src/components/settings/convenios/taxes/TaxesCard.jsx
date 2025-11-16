import { useEffect, useMemo, useState } from 'react';
import { Filter, LineChart, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { MODALITIES, PRODUCT_OPTIONS } from '@/features/agreements/convenioSettings.constants.ts';
import { formatCurrency, formatPercent } from '@/features/agreements/utils/dailyCoefficient.js';
import { formatDate } from '@/features/agreements/convenioSettings.utils.ts';
import TaxDialog from './TaxDialog.jsx';

const TaxesCard = ({ products, taxes, onUpsert, readOnly }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [product, setProduct] = useState(() => (products?.[0] ?? PRODUCT_OPTIONS[0]));

  useEffect(() => {
    if (!products?.length) {
      return;
    }
    if (products.includes(product)) {
      return;
    }
    setProduct(products[0]);
  }, [product, products]);

  const filteredTaxes = useMemo(() => (taxes ?? []).filter((tax) => tax.produto === product), [taxes, product]);

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
              {(products?.length ? products : PRODUCT_OPTIONS).map((item) => (
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
              {filteredTaxes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Nenhuma taxa cadastrada para este produto.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTaxes.map((tax) => (
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

export default TaxesCard;
