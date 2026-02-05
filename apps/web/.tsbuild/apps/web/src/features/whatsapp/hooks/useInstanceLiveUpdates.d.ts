export default useInstanceLiveUpdates;
/**
 * Hook de atualizações em tempo real das instâncias do WhatsApp.
 *
 * Melhorias aplicadas:
 * - Evita múltiplas conexões e ouvintes duplicados ao remover `onEvent` do array de dependências
 *   e usar um `callbackRef` estável.
 * - Limpeza rigorosa dos listeners e do socket na desmontagem ou troca de tenant.
 * - Backoff de reconexão menos agressivo para reduzir tempestades de conexão.
 * - Join do tenant com ACK para depuração de erro de sala.
 * - Guardas SSR e de `enabled/tenantId` para não iniciar quando não for necessário.
 */
declare function useInstanceLiveUpdates({ tenantId, enabled, onEvent }: {
    tenantId: any;
    enabled?: boolean | undefined;
    onEvent: any;
}): {
    connected: boolean;
    connectionError: null;
};
