import { useCallback, useId, useMemo, useState } from 'react';
import { Bookmark, Check, ChevronDown, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
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
import { cn } from '@/lib/utils.js';
import type { CrmFilterState, CrmSavedView, CrmSavedViewScope } from '../state/types';

/**
 * Visões salvas ficam no navegador (localStorage), então só existe o escopo "Pessoal".
 * Compartilhar com equipe/organização depende de persistência no servidor.
 */
const CrmSavedViewsMenu = ({
  views,
  activeViewId,
  filters,
  onSelect,
  onSave,
  onUpdate,
  onDelete,
  isSaving,
  isDeleting,
}: {
  views: CrmSavedView[];
  activeViewId: string | null;
  filters: CrmFilterState;
  onSelect: (viewId: string | null) => Promise<unknown>;
  onSave: (payload: { name: string; scope: CrmSavedViewScope; filters: CrmFilterState }) => Promise<unknown>;
  onUpdate: (payload: { view: CrmSavedView; filters: CrmFilterState }) => Promise<unknown>;
  onDelete: (view: CrmSavedView) => Promise<unknown>;
  isSaving: boolean;
  isDeleting: boolean;
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const nameId = useId();

  const activeView = useMemo(
    () => (activeViewId ? views.find((view) => view.id === activeViewId) ?? null : null),
    [activeViewId, views]
  );

  const handleSaveNew = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    await onSave({ name: trimmed, scope: 'personal', filters });
    setName('');
    setDialogOpen(false);
  }, [filters, name, onSave]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant={activeView ? 'soft' : 'outline'} className="max-w-[220px] gap-2">
            <Bookmark aria-hidden="true" />
            <span className="truncate">{activeView?.name ?? 'Visões salvas'}</span>
            <ChevronDown className="text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Minhas visões</DropdownMenuLabel>
          {views.length === 0 ? (
            <p className="px-2 pb-2 text-sm text-muted-foreground">
              Salve uma combinação de filtros para reaplicar com um clique.
            </p>
          ) : (
            views.map((view) => {
              const isActive = view.id === activeViewId;
              return (
                <DropdownMenuItem key={view.id} onSelect={() => void onSelect(view.id)} className="group gap-2 pr-1">
                  <Check className={cn('size-4', isActive ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                  <span className="flex-1 truncate">{view.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 group-focus:opacity-100"
                    aria-label={`Excluir visão ${view.name}`}
                    disabled={isDeleting}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void onDelete(view);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </DropdownMenuItem>
              );
            })
          )}
          <DropdownMenuSeparator />
          {activeView ? (
            <>
              <DropdownMenuItem disabled={isSaving} onSelect={() => void onUpdate({ view: activeView, filters })}>
                {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                Atualizar “{activeView.name}”
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void onSelect(null)}>
                <RotateCcw />
                Voltar à visão padrão
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
            <Plus />
            Salvar filtros atuais…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Salvar visão</DialogTitle>
            <DialogDescription>
              Guarda a busca e os filtros atuais. A visão fica salva só neste navegador.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveNew();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={nameId}>Nome da visão</Label>
              <Input
                id={nameId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: INSS parados há 3 dias"
                maxLength={60}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || !name.trim()}>
                {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Salvar visão
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CrmSavedViewsMenu;
