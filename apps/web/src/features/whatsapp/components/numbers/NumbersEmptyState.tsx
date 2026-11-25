import { Check, MessageCircle, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';

import SafetyTipsPopover from '../SafetyTips';

const CHECKLIST = ['Celular com WhatsApp ativo', 'Número dedicado ao comercial', 'Cerca de 2 minutos'];

interface NumbersEmptyStateProps {
  onConnect: () => void;
  canCreate: boolean;
}

/** Primeiro acesso: uma única tarefa clara — conectar o primeiro número. */
const NumbersEmptyState = ({ onConnect, canCreate }: NumbersEmptyStateProps) => {
  const connectButton = (
    <Button type="button" size="lg" onClick={onConnect} disabled={!canCreate}>
      <Plus aria-hidden="true" />
      Conectar número
    </Button>
  );

  return (
    <section
      aria-labelledby="numbers-empty-title"
      className="rounded-xl border border-border bg-surface px-6 py-12 text-center shadow-xs sm:py-16"
    >
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-whatsapp-soft text-whatsapp-soft-foreground">
          <MessageCircle aria-hidden="true" className="size-7" />
        </div>
        <div className="space-y-2">
          <h2 id="numbers-empty-title" className="text-xl font-semibold text-foreground">
            Conecte seu primeiro número
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Os leads que chegarem por WhatsApp caem direto na Inbox do seu time.
          </p>
        </div>
        <ul className="flex flex-col items-start gap-2 text-left sm:flex-row sm:justify-center sm:gap-x-6">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-foreground">
              <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
              {item}
            </li>
          ))}
        </ul>
        <div className="flex flex-col items-center gap-2">
          {canCreate ? (
            connectButton
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>{connectButton}</span>
              </TooltipTrigger>
              <TooltipContent>Sua sessão não tem uma empresa definida. Entre novamente.</TooltipContent>
            </Tooltip>
          )}
          <SafetyTipsPopover />
        </div>
      </div>
    </section>
  );
};

export default NumbersEmptyState;
