import { Button } from '@/components/ui/button.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { ShieldAlert, Sparkles } from 'lucide-react';

export const QuickActionsBar = ({ onMacro, quality }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-slate-950/25 px-5 py-3 text-xs text-slate-300 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.9)] ring-1 ring-white/5 backdrop-blur">
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/40 px-3 py-1 text-slate-100 ring-1 ring-white/5">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-300" />
                Qualidade WA: {quality?.qualityTier ?? '—'}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Erros/1k msgs: {quality?.errorRatePerThousand ?? '—'} · Limite diário: {quality?.throughputLimit ?? '—'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onMacro}
          className="border-transparent bg-slate-900/40 text-slate-200 hover:bg-slate-900/30"
        >
          <Sparkles className="mr-1 h-4 w-4" /> Aplicar macro
        </Button>
      </div>
    </div>
  );
};

export default QuickActionsBar;
