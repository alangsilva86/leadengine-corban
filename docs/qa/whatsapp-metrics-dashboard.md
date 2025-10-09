# Validação de métricas do dashboard de instâncias WhatsApp

## Endpoints avaliados

| Endpoint | Descrição | Status |
| --- | --- | --- |
| `GET /api/integrations/whatsapp/instances` | Lista instâncias normalizadas, incluindo métricas agregadas utilizadas nos cards. | ✅ Coberto por testes de integração existentes (`lists WhatsApp instances`). |
| `GET /api/integrations/whatsapp/instances/:id/status` | Retorna estado atualizado da instância com instantâneo completo utilizado para hidratação dos cards. | ✅ Novo teste automatizado assegura normalização das métricas (`normalizes broker metrics in status payloads for the dashboard cards`). |
| `GET /api/integrations/whatsapp/instances/:id/metrics` | Exposição direta das métricas do broker para inspeções pontuais e fallback do front. | ✅ Validado em testes automatizados (`proxies metrics retrieval to the broker`). |

## Ajustes executados

- Adicionada suíte de teste que confirma a entrega de métricas normalizadas (mensagens enviadas, fila, falhas, distribuição por status e uso de taxa) na resposta de `GET /api/integrations/whatsapp/instances/:id/status`, garantindo consistência com os cards do dashboard e preservando o layout mesmo com valores parciais do broker.

## Evidências

- Logs de execução dos testes `vitest` contendo as execuções dos cenários acima.
- Teste automatizado localizado em `apps/api/src/routes/integrations.test.ts`.

## Próximos passos sugeridos

- Monitorar tempos de resposta reais do broker em ambientes de staging/produção e, se necessário, incluir métricas de performance nos dashboards.
- Instrumentar o front-end para exibir estados de loading/erro específicos por card quando o endpoint individual de métricas for consumido futuramente.
