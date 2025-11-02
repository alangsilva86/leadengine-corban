import { randomUUID } from 'node:crypto';

import { listMemoryRecords } from '../../data/ai-store';
import { AiConversationMessage, AiSuggestion, AiSuggestionResult } from './types';

export type SuggestionInput = {
  tenantId: string;
  contactId: string;
  ticketId: string;
  conversation: AiConversationMessage[];
  limit?: number;
};

const DEFAULT_SUGGESTION_LIMIT = 3;

const buildBaseSuggestions = (contactName: string | null, lastMessage: string | null): string[] => {
  const name = contactName ?? 'cliente';
  const suggestions: string[] = [
    `Olá ${name}, agradeço pela conversa! Fico à disposição para esclarecer qualquer ponto adicional e garantir que prossigamos com confiança.`,
    `Gostaria de reforçar os próximos passos e verificar se ficou algum detalhe pendente. Posso avançar com a próxima etapa agora mesmo?`,
    `Estou acompanhando pessoalmente o andamento e posso enviar a proposta atualizada ainda hoje. Deseja que eu encaminhe por e-mail ou WhatsApp?`,
  ];

  if (lastMessage) {
    suggestions.unshift(
      `Sobre a sua mensagem “${lastMessage.slice(0, 120)}”, preparei um resumo claro com orientações para avançarmos sem atrasos.`,
    );
  }

  return suggestions;
};

const buildSuggestion = (text: string, rationale?: string): AiSuggestion => ({
  id: randomUUID(),
  text,
  rationale,
});

const resolveContactNameFromMemories = (tenantId: string, contactId: string): string | null => {
  const records = listMemoryRecords(tenantId, contactId);
  for (const record of records) {
    if (record.topic.toLowerCase() === 'contact:name') {
      return record.content;
    }
  }
  return null;
};

const pickLastUserMessage = (conversation: AiConversationMessage[]): string | null => {
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const entry = conversation[index];
    if (entry.role === 'user' && entry.content.trim().length > 0) {
      return entry.content.trim();
    }
  }
  return null;
};

export const generateAiSuggestions = async (
  input: SuggestionInput
): Promise<AiSuggestionResult> => {
  const limit = Math.max(1, Math.min(input.limit ?? DEFAULT_SUGGESTION_LIMIT, 5));
  const contactName = resolveContactNameFromMemories(input.tenantId, input.contactId);
  const lastMessage = pickLastUserMessage(input.conversation);

  const candidates = buildBaseSuggestions(contactName, lastMessage);
  const suggestions = candidates.slice(0, limit).map((text) =>
    buildSuggestion(text, lastMessage ? 'Personalizada com base na última mensagem recebida.' : undefined)
  );

  return {
    suggestions,
    generatedAt: new Date().toISOString(),
  };
};
