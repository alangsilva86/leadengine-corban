import { useEffect, useMemo, useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { Button } from '@/components/ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import type { ImportAgreementsResponse } from '@/lib/agreements-client.ts';

type ImportVariables = { formData: FormData };

type ImportMutation = UseMutationResult<ImportAgreementsResponse, unknown, ImportVariables, unknown>;

type AgreementImportDialogProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  mutation: ImportMutation;
  onImported?: (response: ImportAgreementsResponse) => void;
};

type ExtractedImportError = {
  message: string;
  errors: Array<{
    row?: number;
    message?: string;
    code?: string;
    column?: string;
  }>;
};

const ACCEPTED_TYPES = '.csv,.xlsx,.xls,.json';

const parseImportError = (rawError: unknown): ExtractedImportError | null => {
  if (!rawError || typeof rawError !== 'object') {
    return null;
  }

  const payload = 'payload' in rawError ? (rawError as { payload?: unknown }).payload : null;
  if (!payload || typeof payload !== 'object') {
    const fallback = rawError as Error;
    return {
      message: fallback?.message ?? 'Falha ao importar convênios',
      errors: [],
    };
  }

  const errorSection = (payload as Record<string, unknown>).error;
  const dataSection = (payload as Record<string, unknown>).data;

  const message =
    (errorSection && typeof errorSection === 'object' && 'message' in errorSection
      ? (errorSection as Record<string, unknown>).message
      : null) ||
    (rawError as Error)?.message ||
    'Falha ao importar convênios';

  const errors = Array.isArray((dataSection as Record<string, unknown> | undefined)?.errors)
    ? ((dataSection as { errors: ExtractedImportError['errors'] }).errors ?? [])
    : [];

  return {
    message: typeof message === 'string' ? message : 'Falha ao importar convênios',
    errors,
  };
};

const AgreementImportDialog = ({ open, onOpenChange, mutation, onImported }: AgreementImportDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [progress, setProgress] = useState(0);

  const { data, error, isPending, reset, mutate } = mutation;

  useEffect(() => {
    if (open) {
      return;
    }

    setFile(null);
    setMode('merge');
    setProgress(0);

    if (data || error || isPending) {
      reset();
    }
  }, [open, data, error, isPending, reset]);

  useEffect(() => {
    if (!isPending) {
      setProgress(data ? 100 : 0);
      return;
    }

    setProgress(20);
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 90) {
          return current;
        }
        return current + 10;
      });
    }, 400);

    return () => {
      window.clearInterval(timer);
    };
  }, [isPending, data]);

  const errorDetails = useMemo(() => parseImportError(error), [error]);

  const processImport = () => {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

    mutate(
      { formData },
      {
        onSuccess: (response) => {
          if (response && typeof onImported === 'function') {
            onImported(response);
          }
        },
      }
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    processImport();
  };

  const summary = data?.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Importar convênios</DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo CSV, XLSX ou JSON com convênios, janelas e taxas. As linhas inválidas são reportadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="agreement-file">Arquivo de importação</Label>
            <Input
              id="agreement-file"
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
              }}
              required
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">Formatos aceitos: CSV, XLSX, XLS e JSON.</p>
          </div>
          <div className="space-y-2">
            <Label>Modo</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as 'merge' | 'replace')} disabled={isPending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="merge">Mesclar com convênios existentes</SelectItem>
                <SelectItem value="replace">Substituir convênios existentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isPending ? (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">Processando arquivo...</p>
            </div>
          ) : null}
          {summary ? (
            <div className="rounded-md border border-border/60 bg-muted/40 p-4 text-sm">
              <p className="font-medium text-foreground">Resumo</p>
              <ul className="mt-2 space-y-1">
                <li>
                  <span className="font-medium text-foreground">Novos:</span> {summary.imported}
                </li>
                <li>
                  <span className="font-medium text-foreground">Atualizados:</span> {summary.updated}
                </li>
                <li>
                  <span className="font-medium text-foreground">Falhas:</span> {summary.failed}
                </li>
              </ul>
              {summary.errors && summary.errors.length > 0 ? (
                <ScrollArea className="mt-3 max-h-40 rounded-md border border-border bg-background">
                  <ul className="divide-y divide-border text-xs">
                    {summary.errors.map((item, index) => (
                      <li key={`${item.row ?? index}-${item.code ?? 'error'}`} className="p-2">
                        <p className="font-medium text-destructive">
                          Linha {item.row ?? '—'}: {item.message ?? 'Erro desconhecido'}
                        </p>
                        {item.code ? <p className="text-muted-foreground">Código: {item.code}</p> : null}
                        {item.column ? <p className="text-muted-foreground">Coluna: {item.column}</p> : null}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : null}
            </div>
          ) : null}
          {errorDetails ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-medium text-destructive">{errorDetails.message}</p>
              {errorDetails.errors.length > 0 ? (
                <ScrollArea className="mt-2 max-h-40">
                  <ul className="space-y-1">
                    {errorDetails.errors.map((item, index) => (
                      <li key={`${item.row ?? index}-${item.code ?? 'error'}`} className="text-xs text-muted-foreground">
                        {item.row ? `Linha ${item.row}: ` : ''}
                        {item.message ?? 'Erro desconhecido'}
                        {item.code ? ` · Código ${item.code}` : ''}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" onClick={processImport} disabled={!file || isPending}>
              Importar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AgreementImportDialog;
