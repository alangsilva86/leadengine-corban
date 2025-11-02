import { useCallback, useMemo, useState } from 'react';
import { Bookmark, ChevronDown, FolderPlus, Loader2, MoreHorizontal, Save, Trash2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import type { CrmFilterState, CrmSavedView, CrmSavedViewScope } from '../state/types';

const SCOPE_OPTIONS: { value: CrmSavedViewScope; label: string }[] = [
  { value: 'personal', label: 'Pessoal' },
  { value: 'team', label: 'Equipe' },
  { value: 'organization', label: 'Organização' },
];

const EmptySavedViews = () => (
  <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma visão salva.</div>
);

const useViewForm = (initialScope: CrmSavedViewScope = 'personal') => {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<CrmSavedViewScope>(initialScope);

  const reset = useCallback(() => {
    setName('');
    setScope(initialScope);
  }, [initialScope]);

  return { name, setName, scope, setScope, reset };
};

const SavedViewActions = ({
  view,
  onDelete,
  deleting,
}: {
  view: CrmSavedView;
  onDelete: (view: CrmSavedView) => Promise<unknown>;
  deleting: boolean;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDelete = useCallback(async () => {
    setMenuOpen(false);
    await onDelete(view);
  }, [onDelete, view]);

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onSelect={async (event) => {
            event.preventDefault();
            if (deleting) return;
            await handleDelete();
          }}
          disabled={deleting}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Excluir visão
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

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
  const [savingExisting, setSavingExisting] = useState(false);
  const form = useViewForm();

  const activeView = useMemo(() => {
    if (!activeViewId) {
      return null;
    }
    return views.find((view) => view.id === activeViewId) ?? null;
  }, [activeViewId, views]);

  const handleSelect = useCallback(
    async (viewId: string | null) => {
      await onSelect(viewId);
    },
    [onSelect]
  );

  const handleSaveNew = useCallback(async () => {
    if (!form.name.trim()) {
      return;
    }
    await onSave({ name: form.name.trim(), scope: form.scope, filters });
    form.reset();
    setDialogOpen(false);
  }, [filters, form, onSave]);

  const handleUpdateActive = useCallback(async () => {
    if (!activeView) {
      return;
    }
    setSavingExisting(true);
    try {
      await onUpdate({ view: activeView, filters });
    } finally {
      setSavingExisting(false);
    }
  }, [activeView, filters, onUpdate]);

  const menuLabel = activeView?.name ?? 'Visões salvas';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-2 rounded-lg border-border/60 bg-background px-3 text-sm"
          >
            <Bookmark className="h-4 w-4" />
            <span className="font-medium">{menuLabel}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="flex items-center justify-between">
            Visões salvas
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setDialogOpen(true)}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {views.length === 0 ? <EmptySavedViews /> : null}
          {views.map((view) => {
            const isActive = view.id === activeViewId;
            return (
              <DropdownMenuItem
                key={view.id}
                className="flex items-center justify-between gap-2"
                onSelect={() => handleSelect(view.id)}
              >
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">{view.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {SCOPE_OPTIONS.find((option) => option.value === view.scope)?.label ?? view.scope}
                  </span>
                </span>
                {isActive ? (
                  <BadgeActive />
                ) : (
                  <SavedViewActions view={view} onDelete={onDelete} deleting={isDeleting} />
                )}
              </DropdownMenuItem>
            );
          })}
          {views.length > 0 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem onSelect={() => handleSelect(null)}>Visão padrão</DropdownMenuItem>
          {activeView ? (
            <DropdownMenuItem
              disabled={savingExisting || isSaving}
              onSelect={(event) => {
                event.preventDefault();
                handleUpdateActive();
              }}
            >
              {savingExisting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
              Salvar alterações
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar visão atual</DialogTitle>
            <DialogDescription>
              Nomeie a configuração de filtros atual para acessá-la rapidamente depois ou compartilhar com a equipe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nome da visão</label>
              <Input
                value={form.name}
                onChange={(event) => form.setName(event.target.value)}
                placeholder="Leads em negociação quente"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Escopo</label>
              <Select value={form.scope} onValueChange={(value: CrmSavedViewScope) => form.setScope(value)}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Selecionar escopo" />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveNew} disabled={isSaving || !form.name.trim()}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar visão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const BadgeActive = () => (
  <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[0.65rem] font-semibold text-primary">
    Atual
  </span>
);

export default CrmSavedViewsMenu;
