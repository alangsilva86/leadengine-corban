import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Check, ChevronDown, Loader2, Lock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { cn } from '@/lib/utils.js';
import {
  LEAD_STAGE_TONE_CLASSES,
  getAllowedLeadStageTargets,
  getLeadStageOptions,
  getLeadStagePresentation,
  normalizeLeadStage,
  type LeadStage,
  type LeadStageOption,
} from '../../utils/lead-stage';

type LeadStageMenuItemsProps = {
  stage: unknown;
  onSelect: (stage: LeadStage) => void;
};

const StageItem = ({ option, onSelect }: { option: LeadStageOption; onSelect: (stage: LeadStage) => void }) => (
  <DropdownMenuItem
    role="menuitemradio"
    aria-checked={option.current}
    disabled={option.disabled}
    title={option.reason ?? option.description}
    onSelect={() => {
      if (!option.current) onSelect(option.id);
    }}
    className={cn('gap-2', option.current && 'font-medium')}
  >
    <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', LEAD_STAGE_TONE_CLASSES[option.tone].dot)} />
    <span className="flex-1">{option.label}</span>
    {option.current ? <Check className="text-primary" aria-hidden="true" /> : null}
  </DropdownMenuItem>
);

/**
 * Itens "Mover para…" com todas as etapas do funil e as saídas (marcando a atual).
 * Transições proibidas pelo contrato aparecem desabilitadas, com o motivo no rodapé.
 */
export const LeadStageMenuItems = ({ stage, onSelect }: LeadStageMenuItemsProps) => {
  const current = normalizeLeadStage(stage);
  const options = getLeadStageOptions(current);
  const blockedReason = options.find((option) => option.disabled)?.reason ?? null;

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Funil</DropdownMenuLabel>
        {options
          .filter((option) => !option.exit)
          .map((option) => (
            <StageItem key={option.id} option={option} onSelect={onSelect} />
          ))}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Saídas</DropdownMenuLabel>
        {options
          .filter((option) => option.exit)
          .map((option) => (
            <StageItem key={option.id} option={option} onSelect={onSelect} />
          ))}
      </DropdownMenuGroup>
      {blockedReason ? (
        <p className="mt-1 flex items-start gap-1.5 border-t border-border px-2 pb-1 pt-2 text-xs text-muted-foreground">
          <Lock className="mt-px size-3 shrink-0" aria-hidden="true" />
          {blockedReason}
        </p>
      ) : null}
    </>
  );
};

type LeadStageMenuProps = LeadStageMenuItemsProps & {
  /** Botão que abre o menu (renderizado com `asChild`). */
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  /** Rótulo acessível do menu. */
  label?: string;
};

/** Menu "Mover para…" pronto: gatilho + etapas permitidas. */
const LeadStageMenu = ({ stage, onSelect, children, align = 'end', label = 'Mover para' }: LeadStageMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
    <DropdownMenuContent align={align} className="w-60" aria-label={label}>
      <LeadStageMenuItems stage={stage} onSelect={onSelect} />
    </DropdownMenuContent>
  </DropdownMenu>
);

type LeadStageChipProps = ComponentPropsWithoutRef<'button'> & {
  stage: unknown;
  pending?: boolean;
};

/** Chip da etapa que abre o menu "Mover para…" (cabeçalho do lead, painel do contato). */
export const LeadStageChip = forwardRef<HTMLButtonElement, LeadStageChipProps>(
  ({ stage, pending = false, className, disabled, ...props }, ref) => {
    const presentation = getLeadStagePresentation(stage);
    const locked = getAllowedLeadStageTargets(presentation.id).length === 0;
    return (
      <button
        ref={ref}
        type="button"
        aria-label={`Etapa do lead: ${presentation.label}. Mover para outra etapa`}
        title={locked ? 'Lead ganho é final: a etapa não muda mais.' : presentation.description}
        disabled={disabled || locked || pending}
        className={cn(
          'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-[box-shadow,filter]',
          'hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:brightness-100 dark:hover:brightness-110',
          'data-[state=open]:ring-2 data-[state=open]:ring-ring/40',
          presentation.classes.chip,
          className
        )}
        {...props}
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
        ) : (
          <span aria-hidden="true" className={cn('size-1.5 rounded-full', presentation.classes.dot)} />
        )}
        {presentation.label}
        {locked ? null : <ChevronDown className="-mr-0.5 size-3 opacity-70" aria-hidden="true" />}
      </button>
    );
  }
);

LeadStageChip.displayName = 'LeadStageChip';

export default LeadStageMenu;
