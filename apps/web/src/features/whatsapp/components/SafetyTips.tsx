import { ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { cn } from '@/lib/utils.js';

/**
 * Boas práticas para reduzir o risco de bloqueio do número pelo WhatsApp.
 * Tom direto e sem alarmismo; não promete limites nem notas que a API não fornece.
 */
const SAFETY_TIPS = [
  {
    title: 'Aqueça números novos aos poucos',
    description: 'Nos primeiros dias, converse com poucas pessoas e aumente o volume gradualmente.',
  },
  {
    title: 'Responda rápido',
    description: 'Conversas com resposta são bem avaliadas. Evite deixar clientes sem retorno.',
  },
  {
    title: 'Só fale com quem pediu contato',
    description: 'Não envie mensagens para listas compradas ou contatos que não autorizaram.',
  },
  {
    title: 'Ofereça a saída',
    description: 'Inclua "Responda SAIR para não receber mais mensagens" e respeite o pedido.',
  },
] as const;

const SafetyTipsList = ({ className }: { className?: string }) => (
  <ol className={cn('space-y-3', className)}>
    {SAFETY_TIPS.map((tip, index) => (
      <li key={tip.title} className="flex gap-3">
        <span
          aria-hidden="true"
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[0.7rem] font-semibold text-muted-foreground"
        >
          {index + 1}
        </span>
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">{tip.title}</p>
          <p className="text-xs text-muted-foreground">{tip.description}</p>
        </div>
      </li>
    ))}
  </ol>
);

interface SafetyTipsPopoverProps {
  label?: string;
  variant?: 'link' | 'ghost' | 'outline';
  size?: 'sm' | 'default' | 'xs';
  className?: string;
  align?: 'start' | 'center' | 'end';
}

const SafetyTipsPopover = ({
  label = 'Boas práticas para evitar bloqueio',
  variant = 'link',
  size = 'sm',
  className,
  align = 'center',
}: SafetyTipsPopoverProps) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(variant === 'link' && 'px-0 has-[>svg]:px-0', className)}
      >
        <ShieldCheck aria-hidden="true" />
        {label}
      </Button>
    </PopoverTrigger>
    <PopoverContent align={align} className="w-80 space-y-3 p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Boas práticas para evitar bloqueio</p>
        <p className="text-xs text-muted-foreground">
          O WhatsApp pode restringir números que recebem muitas denúncias. Estes cuidados ajudam a manter o seu ativo.
        </p>
      </div>
      <SafetyTipsList />
    </PopoverContent>
  </Popover>
);

export default SafetyTipsPopover;
