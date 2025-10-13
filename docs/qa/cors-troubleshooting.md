# Ticketz API CORS troubleshooting

## Contexto do erro

Ao abrir a aplicação hospedada em `https://leadengine-corban.up.railway.app` o console do navegador pode exibir mensagens como:

```
Access to fetch at 'https://ticketzapi-production.up.railway.app/health' from origin 'https://leadengine-corban.up.railway.app' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
Failed to load resource: net::ERR_FAILED
```

Essas mensagens indicam que o navegador recebeu uma resposta sem o cabeçalho `Access-Control-Allow-Origin` esperado durante a requisição de *preflight* (HTTP `OPTIONS`). Sem esse cabeçalho o navegador bloqueia a chamada para a API e a aplicação passa a tratar o problema como uma falha de rede.

## Causa mais comum

A instância `ticketzapi-production` da API precisa saber quais domínios estão autorizados a consumi-la. Isso é feito através das variáveis de ambiente `FRONTEND_URL` (origem principal) e `CORS_ALLOWED_ORIGINS` (lista extra de domínios). Quando o domínio de produção do frontend não aparece nessas variáveis a API responde ao *preflight* sem o cabeçalho de permissão, o que dispara o erro de CORS no navegador.

> **Importante:** Mesmo que o domínio já apareça no código (via `defaultCorsOrigins`), a configuração em produção prevalece. Se o valor salvo na Railway estiver vazio ou incorreto a API **não** libera o domínio.

## Como validar e corrigir

1. Acesse a instância `ticketzapi-production` da API no painel da Railway.
2. Confirme que as variáveis `FRONTEND_URL` e `CORS_ALLOWED_ORIGINS` contêm o domínio do frontend de produção (`https://leadengine-corban.up.railway.app`).
   - Utilize [`docs/environments/ticketzapi-production.env`](../environments/ticketzapi-production.env) como referência.
   - Caso haja múltiplos domínios, separe-os por vírgula.
3. Salve as alterações e reinicie o serviço para aplicar as novas variáveis.
4. Após o deploy, teste novamente o endpoint `/health` com `curl` incluindo o cabeçalho `Origin`:

   ```bash
   curl -I \
     -H "Origin: https://leadengine-corban.up.railway.app" \
     https://ticketzapi-production.up.railway.app/health
   ```

   A resposta deve incluir `Access-Control-Allow-Origin: https://leadengine-corban.up.railway.app`.

5. Recarregue o frontend. Se o cabeçalho estiver presente o navegador deixará de bloquear as requisições e os dados voltarão a carregar normalmente.

## Checklist rápido

- [ ] `FRONTEND_URL` e `CORS_ALLOWED_ORIGINS` atualizados com o domínio do frontend.
- [ ] Serviço reiniciado após a mudança das variáveis.
- [ ] Resposta do `/health` contém `Access-Control-Allow-Origin` com o domínio correto.
- [ ] Frontend volta a carregar dados sem erros de CORS.

Seguindo esse fluxo é possível identificar rapidamente se o problema está na configuração de CORS e corrigi-lo sem precisar alterar o código da aplicação.
