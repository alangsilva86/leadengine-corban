import { ArrowLeft, User } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import useInstancePresentation from '../../../hooks/useInstancePresentation.js';
import { buildInitialsFromName, toSentenceCase } from '../utils/presentation.js';

/**
 * Quem é o cliente: avatar, nome e "+55 11 9xxxx · via {número}".
 * No celular, mostra "Voltar" para a lista.
 */
const HeaderIdentity = ({ name, phone, instanceId, isWhatsApp = true, typingLabel = null, onBack }) => {
  const instance = useInstancePresentation(instanceId);
  const instanceLabel = instance.known ? toSentenceCase(instance.label) : null;
  const subtitle = [phone, instanceLabel ? `via ${instanceLabel}` : null].filter(Boolean).join(' · ');

  return (
    <div className="flex min-w-[7rem] flex-1 items-center gap-2.5">
      {onBack ? (
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-1.5 shrink-0 px-2" aria-label="Voltar para a lista de conversas">
          <ArrowLeft aria-hidden />
          <span>Voltar</span>
        </Button>
      ) : null}
      <span className={cn('relative size-9 shrink-0', onBack ? 'hidden @md:inline-flex' : 'inline-flex')} aria-hidden>
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-surface-sunken text-sm font-semibold text-muted-foreground">
          {buildInitialsFromName(name, '') || <User className="size-4" />}
        </span>
        {isWhatsApp ? (
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-whatsapp" />
        ) : null}
      </span>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold leading-tight text-foreground" title={name}>
          {name}
        </h2>
        {typingLabel ? (
          <p className="truncate text-xs italic leading-tight text-primary" aria-live="polite">
            {typingLabel}
          </p>
        ) : subtitle ? (
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <p className="truncate text-xs leading-tight text-muted-foreground" tabIndex={-1}>
                {subtitle}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isWhatsApp ? 'Conversa pelo WhatsApp' : 'Conversa'}
              {instance.phone ? ` · número ${instance.phone}` : ''}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
};

export default HeaderIdentity;
