import { useMutation } from '@tanstack/react-query';

const buildMockSuggestions = ({ ticket, messages }) => {
  const lastMessage = messages?.[messages.length - 1]?.payload ?? messages?.[messages.length - 1] ?? null;
  const contactName = ticket?.contact?.name ?? 'cliente';
  const subject = ticket?.lead?.value ? `a proposta de R$ ${ticket.lead.value}` : 'nosso atendimento';

  const base = [
    `Olá ${contactName}, obrigado por falar com a gente! Estou finalizando ${subject} e quero garantir que ficou tudo claro.`,
    `Percebi que a janela está prestes a expirar. Posso te ajudar com mais alguma informação para avançarmos?`,
    `Acabo de revisar os dados e já posso enviar a minuta. Confirmo o melhor e-mail/WhatsApp para encaminhar?`,
  ];

  if (typeof lastMessage?.content === 'string' && lastMessage.content.length > 0) {
    base.unshift(`Você mencionou: “${lastMessage.content.slice(0, 120)}”. Segue uma resposta cordial reforçando próximos passos.`);
  }

  return base.slice(0, 3);
};

export const useAiSuggestions = () => {
  const mutation = useMutation({
    mutationKey: ['chat', 'ai-suggestions'],
    mutationFn: async ({ ticket, timeline }) => {
      // Placeholder: simula request em 600 ms e retorna sugestões baseadas no contexto.
      await new Promise((resolve) => setTimeout(resolve, 600));
      return buildMockSuggestions({ ticket, messages: timeline });
    },
  });

  return {
    requestSuggestions: (payload) => mutation.mutateAsync(payload),
    isLoading: mutation.isPending,
    suggestions: mutation.data ?? [],
    reset: mutation.reset,
    error: mutation.error,
  };
};

export default useAiSuggestions;
