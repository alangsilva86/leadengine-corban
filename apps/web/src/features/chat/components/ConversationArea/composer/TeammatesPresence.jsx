import { Eye } from 'lucide-react';

import { cn } from '@/lib/utils.js';
import { getFirstName } from '../utils/presentation.js';

const FALLBACK_NAME = 'Alguém da equipe';

const nameOf = (agent) => getFirstName(agent?.userName) ?? FALLBACK_NAME;

const joinNames = (agents) => {
  const names = agents.map(nameOf);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names[0]} e mais ${names.length - 1}`;
};

/**
 * Texto do aviso de presença: quem está digitando tem prioridade sobre quem só está com a conversa aberta.
 * Nota interna é rotulada — não é resposta ao cliente, mas indica que alguém está trabalhando no atendimento.
 */
export const formatTeammatesPresence = ({ typing = [], viewers = [] } = {}) => {
  if (typing.length > 0) {
    if (typing.length === 1) {
      return {
        kind: 'typing',
        text:
          typing[0]?.mode === 'note'
            ? `${nameOf(typing[0])} está escrevendo uma nota interna…`
            : `${nameOf(typing[0])} está digitando…`,
      };
    }
    return { kind: 'typing', text: `${joinNames(typing)} estão digitando…` };
  }

  if (viewers.length > 0) {
    const verb = viewers.length === 1 ? 'também está' : 'também estão';
    return { kind: 'viewing', text: `${joinNames(viewers)} ${verb} nesta conversa` };
  }

  return null;
};

const TypingDots = () => (
  <span className="inline-flex items-center gap-0.5" aria-hidden>
    <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
    <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
    <span className="size-1 animate-bounce rounded-full bg-current" />
  </span>
);

/** "Ana está digitando…" / "Bruno também está nesta conversa" — acima do composer, para evitar resposta dupla. */
const TeammatesPresence = ({ typing = [], viewers = [], className }) => {
  const presence = formatTeammatesPresence({ typing, viewers });
  // Sem presença não ocupa espaço (o composer empilha os filhos com gap).
  if (!presence) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="teammates-presence"
      data-kind={presence.kind}
      className={cn(
        'flex items-center gap-1.5 px-1 text-xs',
        presence.kind === 'typing' ? 'font-medium text-primary' : 'text-muted-foreground',
        className
      )}
    >
      {presence.kind === 'typing' ? <TypingDots /> : <Eye className="size-3.5 shrink-0" aria-hidden />}
      <span className="min-w-0 truncate">{presence.text}</span>
    </p>
  );
};

export default TeammatesPresence;
