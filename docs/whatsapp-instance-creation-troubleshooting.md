# Troubleshooting: criação de instância WhatsApp com múltiplos tenants

Este guia resume a sequência de falhas observada ao criar uma nova instância para um tenant e descreve ajustes sugeridos, mapeando cada recomendação às fases do fluxo.

## Sequência observada nos logs
1. **Etapa 1 – GET `/api/integrations/whatsapp/instances?refresh=1` → 503**  
   A UI força um refresh completo das instâncias (parâmetro `refresh=1`) e o backend responde com *Service Unavailable*, indicando indisponibilidade temporária ou degradação no serviço de integração/broker.
2. **Etapa 2 – GET repetido `/api/integrations/whatsapp/instances?refresh=1` → 503**  
   A nova tentativa imediata falha da mesma forma, sugerindo que a indisponibilidade persiste e possivelmente não há retentativa com backoff ou fallback para cache local.
3. **Etapa 3 – GET `/api/integrations/whatsapp/instances` → 502**  
   A consulta padrão (sem refresh) recebe *Bad Gateway*, normalmente sinal de erro ao consultar o broker ou ao sincronizar o status das instâncias.
4. **Etapa 4 – POST `/api/integrations/whatsapp/instances` → 502**  
   A criação da instância falha na chamada ao broker (gateway), impedindo que o tenant receba um ID de instância válido.

## Pontos de controle no backend
- **Listagem e rate limiting**: a listagem passa por um rate-limiter in-memory e pode ser forçada via `refresh` ou `mode=sync`, antes de coletar instâncias para o tenant. (`apps/api/src/routes/integrations.ts`)
- **Criação de instâncias**: a rota POST valida payload com `createWhatsAppInstanceSchema`, registra logs com `tenantId`/`actorId` e executa efeitos colaterais (ex.: chamadas ao broker, gravação em banco) via `createWhatsAppInstance` e `executeSideEffects`. (`apps/api/src/routes/integrations.ts`)

## Ajustes e otimizações recomendadas
- **Etapa 1–2: resilência no refresh**  
  Implementar backoff exponencial e fallback para cache local quando `refresh=1` falhar, reduzindo tráfego repetido durante indisponibilidades temporárias do broker. Também registrar causa raiz (ex.: DNS, timeouts ou 503 direto do broker) para depuração rápida.
- **Etapa 3: health checks antes do sync**  
  Acrescentar verificação de saúde do broker antes de listar instâncias e retornar um erro explícito (ex.: `BROKER_UNAVAILABLE`) com orientação para o usuário, evitando 502 genérico.
- **Etapa 4: criação idempotente e mensagens claras**  
  Ao receber 502 na criação, capturar e propagar o erro específico do broker (tempo de resposta, autenticação ou quota) e manter a operação idempotente para retries seguros do frontend.
- **Observabilidade transversal**  
  Adicionar métricas/alertas por etapa (refresh, listagem, criação) com tags de `tenantId` para detectar tenants impactados e iniciar mitigação proativa.
