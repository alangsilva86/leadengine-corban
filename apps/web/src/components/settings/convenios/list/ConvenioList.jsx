import { Archive, Plus, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { cn } from '@/lib/utils.js';
import { STATUS_OPTIONS } from '@/features/agreements/convenioSettings.constants.ts';
import AgreementImportButton from '../AgreementImportButton.jsx';

const ConvenioList = ({
  convenios,
  selectedId,
  onSelect,
  onArchive,
  readOnly,
  onCreate,
  onOpenImport,
  onRefresh,
  isLoading,
  isFetching,
}) => (
  <Card className="border-dashed border-border/60">
    <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <CardTitle>Convênios cadastrados</CardTitle>
        <CardDescription>
          Mantenha convênios, produtos e status alinhados com o que o vendedor entende. Arquivar preserva histórico.
        </CardDescription>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <AgreementImportButton onClick={onOpenImport} disabled={readOnly} />
        <Button type="button" variant="ghost" onClick={onRefresh} disabled={isFetching}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isFetching ? 'animate-spin' : '')} /> Atualizar
        </Button>
        <Button type="button" onClick={onCreate} disabled={readOnly}>
          <Plus className="mr-2 h-4 w-4" /> Novo convênio
        </Button>
      </div>
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  Carregando convênios...
                </TableCell>
              </TableRow>
            ) : null}
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
            {convenios.length === 0 && !isLoading ? (
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

export default ConvenioList;
