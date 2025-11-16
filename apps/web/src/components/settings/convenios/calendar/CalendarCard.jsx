import { useMemo, useState } from 'react';
import { CalendarPlus, CalendarX2, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { computeWindowStatus } from '@/features/agreements/utils/dailyCoefficient.js';
import { formatDate } from '@/features/agreements/convenioSettings.utils.ts';
import WindowDialog from './WindowDialog.jsx';

const CalendarCard = ({ windows, onUpsert, onRemove, readOnly }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const sorted = useMemo(
    () => [...(windows ?? [])].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [windows]
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

export default CalendarCard;
