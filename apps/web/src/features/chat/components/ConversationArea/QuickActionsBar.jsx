import { Button } from '@/components/ui/button.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { ShieldAlert, Sparkles, Repeat2 } from 'lucide-react';

export const QuickActionsBar = ({ onReopenWindow, onMacro, quality }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/60 bg-slate-950/80 px-4 py-2 text-xs text-slate-300">
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1">
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
        <Button size="sm" variant="outline" onClick={onMacro} className="border-slate-700/60 text-slate-200">
          <Sparkles className="mr-1 h-4 w-4" /> Aplicar macro
        </Button>
        <Button size="sm" variant="secondary" onClick={onReopenWindow}>
          <Repeat2 className="mr-1 h-4 w-4" /> Reabrir janela
        </Button>
      </div>
    </div>
  );
};

export default QuickActionsBar;
