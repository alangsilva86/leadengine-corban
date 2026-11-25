import { RotateCw, WifiOff, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';

/**
 * Aviso fixo no topo do Inbox quando o tempo real cai ou o navegador fica sem internet.
 * Enquanto isso, a lista e a conversa aberta são atualizadas a cada 15 s.
 */
const ConnectionBanner = ({ online = true, status = 'connected', onRetry }) => {
  const realtimeDown = status === 'reconnecting' || status === 'offline';

  if (online && !realtimeDown) {
    return null;
  }

  const offline = !online;
  const Icon = offline ? WifiOff : Zap;
  const message = offline
    ? 'Você está sem internet. Novas mensagens não chegam até a conexão voltar.'
    : status === 'reconnecting'
      ? 'Reconectando ao tempo real — enquanto isso, atualizamos a cada 15 s.'
      : 'Sem conexão em tempo real — atualizando a cada 15 s.';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex shrink-0 items-center gap-3 border-b px-4 py-2 text-sm',
        offline
          ? 'border-border bg-danger-soft text-danger-soft-foreground'
          : 'border-border bg-warning-soft text-warning-soft-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">{message}</p>
      {!offline && typeof onRetry === 'function' ? (
        <Button type="button" variant="outline" size="xs" onClick={onRetry}>
          <RotateCw aria-hidden />
          Tentar agora
        </Button>
      ) : null}
    </div>
  );
};

export default ConnectionBanner;
