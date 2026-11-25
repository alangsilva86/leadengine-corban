import { createContext, useContext } from 'react';

/**
 * Estado de layout do Inbox compartilhado entre o shell e a área da conversa
 * (painel do contato, voltar para a lista no celular).
 * Fora do shell (testes, stories) o valor é `null` e os componentes usam estado local.
 */
export const InboxLayoutContext = createContext(null);

export const useInboxLayout = () => useContext(InboxLayoutContext);

export default InboxLayoutContext;
