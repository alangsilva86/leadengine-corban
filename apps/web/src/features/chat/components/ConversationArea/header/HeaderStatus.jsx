import { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { cn } from '@/lib/utils.js';
import { getLeadStagePresentation } from '@/features/crm/utils/lead-stage';
import LeadStagePicker from '../LeadStagePicker.jsx';
import { HEADER_CHIP_BASE as chipBase } from './TicketTimeChip.jsx';

/**
 * No máximo dois chips: a etapa do lead (abre o seletor do funil) e um tempo — só quando há valor
 * ("Responder em 12 min", "Janela fecha em 3 h", "Aguardando há 40 min"), passado pronto em `time`
 * (`<TicketTimeChip />`, que tem o próprio relógio).
 */
const HeaderStatus = ({ stage, onStageChange, pendingStage = null, time = null, className }) => {
  const [open, setOpen] = useState(false);
  const presentation = stage ? getLeadStagePresentation(stage) : null;
  const canChange = typeof onStageChange === 'function';

  const handleChange = (next) => {
    setOpen(false);
    onStageChange?.(next);
  };

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      {presentation ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={`Etapa do lead: ${presentation.label}${canChange ? '. Mudar etapa' : ''}`}
              data-stage={presentation.id}
              className={cn(
                chipBase,
                'border-transparent transition-[filter,box-shadow] hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:brightness-110',
                presentation.classes.chip,
              )}
            >
              {pendingStage ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <span aria-hidden className={cn('size-1.5 rounded-full', presentation.classes.dot)} />
              )}
              <span className="max-w-32 truncate">{presentation.label}</span>
              <ChevronDown className="-mr-0.5 size-3 opacity-70" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start" sideOffset={8}>
            <div className="border-b border-border px-4 pb-2.5 pt-3">
              <p className="text-sm font-semibold text-foreground">Etapa do lead</p>
              <p className="text-xs text-muted-foreground">
                {canChange
                  ? 'Vale para o lead no CRM e para as outras conversas deste contato.'
                  : 'A mesma etapa do lead no CRM.'}
              </p>
            </div>
            <LeadStagePicker
              stage={presentation.id}
              onChange={canChange ? handleChange : undefined}
              pendingStage={pendingStage}
              className="p-3"
            />
          </PopoverContent>
        </Popover>
      ) : null}
      {time}
    </div>
  );
};

export default HeaderStatus;
