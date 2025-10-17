import { cn } from '@/lib/utils.js';
import { History } from 'lucide-react';

const Timeline = ({
  surfaceStyles,
  items = [],
  realtimeConnected,
  humanizeLabel,
  formatPhoneNumber,
  formatTimestampLabel,
}) => {
  return (
    <div className={cn('space-y-3 rounded-xl p-4', surfaceStyles.glassTile)}>
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]/70">
        <span className="flex items-center gap-2">
          <History className="h-4 w-4" /> Atividade recente
        </span>
        <span
          className={cn(
            'text-[0.65rem]',
            realtimeConnected ? 'text-emerald-300' : 'text-muted-foreground'
          )}
        >
          {realtimeConnected ? 'Tempo real ativo' : 'Tempo real offline'}
        </span>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn('flex flex-wrap justify-between gap-3 rounded-lg px-3 py-2', surfaceStyles.glassTile)}
            >
              <div className="space-y-1">
                <p className="font-medium text-foreground">{humanizeLabel(item.type)}</p>
                {item.status ? (
                  <p className="text-xs text-muted-foreground">
                    Status: {humanizeLabel(item.status)}
                    {typeof item.connected === 'boolean' ? ` • ${item.connected ? 'Conectado' : 'Desconectado'}` : ''}
                  </p>
                ) : null}
                {item.phoneNumber ? (
                  <p className="text-xs text-muted-foreground">
                    Telefone: {formatPhoneNumber(item.phoneNumber)}
                  </p>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">{formatTimestampLabel(item.timestamp)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Aguardando atividades desta instância. As sincronizações e mudanças de status aparecem aqui em tempo real.
        </p>
      )}
    </div>
  );
};

export default Timeline;
