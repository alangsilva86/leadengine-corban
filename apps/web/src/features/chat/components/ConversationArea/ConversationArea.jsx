import { MessagesSquare } from 'lucide-react';
import { EmptyState } from '@/components/page';
import useConversationExperience from './hooks/useConversationExperience.js';
import ConversationAreaView from './ConversationAreaView.jsx';

const ConversationAreaContent = (props) => {
  const { timeline, composer, header } = useConversationExperience(props);

  return (
    <ConversationAreaView
      timeline={timeline}
      composer={composer}
      header={header}
      currentUser={props.currentUser ?? null}
    />
  );
};

/** Nada selecionado: convite para escolher uma conversa. */
export const NoConversationSelected = () => (
  <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-background p-6">
    <EmptyState
      icon={MessagesSquare}
      title="Selecione uma conversa"
      description="Escolha uma conversa na lista para ler e responder. Use ↑ e ↓ para navegar e Enter para abrir."
    />
  </div>
);

/**
 * Área da conversa. O conteúdo é remontado por conversa (`key`), então composer,
 * rolagem, sugestões da IA e número de envio nunca vazam de um cliente para outro.
 */
export const ConversationArea = (props) => {
  const ticketId = props.ticket?.id ?? null;
  if (!ticketId) {
    return <NoConversationSelected />;
  }
  return <ConversationAreaContent key={ticketId} {...props} />;
};

export default ConversationArea;
