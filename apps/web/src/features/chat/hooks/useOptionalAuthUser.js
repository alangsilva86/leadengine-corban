import { useAuth } from '@/features/auth/AuthProvider.jsx';

// `useAuth` lança erro fora do AuthProvider (testes, stories). A chamada abaixo é
// incondicional — o try/catch só converte a ausência do provider em `null` —, então a
// ordem dos hooks é sempre a mesma. O alias evita o falso positivo do lint de hooks.
const readAuthContext = useAuth;

/**
 * Usuário autenticado quando houver AuthProvider; `null` em testes/isolamento.
 * O Inbox precisa dele para "Minhas", "Assumir conversa" e o rótulo "Você".
 */
export const useOptionalAuthUser = () => {
  let auth = null;
  try {
    auth = readAuthContext();
  } catch {
    auth = null;
  }
  return auth?.user ?? null;
};

export default useOptionalAuthUser;
