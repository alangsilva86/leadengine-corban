# Sincronização de Convênios com Bancos/Promotoras

Este documento descreve os requisitos de ambiente para executar a sincronização de convênios, taxas e tabelas financeiras via trabalhadores da API.

## Variáveis de ambiente

Configure as credenciais e parâmetros de cada integração via variáveis de ambiente:

| Variável | Descrição |
| --- | --- |
| `BANK_HTTP_TIMEOUT_MS` | Timeout padrão (ms) para requisições HTTP. Valor sugerido: `15000`. |
| `BANK_HTTP_MAX_RETRIES` | Quantidade máxima de tentativas por requisição antes de acionar o circuito. Valor sugerido: `3`. |
| `BANK_HTTP_RPS` | Limite base de requisições por segundo aplicado aos clientes. |
| `BANK_ATLAS_BASE_URL` | URL base da Atlas Promotora. |
| `BANK_ATLAS_API_KEY` | API Key para autenticação da Atlas. |
| `BANK_AURORA_BASE_URL` | URL base da Aurora Bank. |
| `BANK_AURORA_USERNAME` / `BANK_AURORA_PASSWORD` | Credenciais de Basic Auth para a Aurora Bank. |
| `BANK_ZENITE_BASE_URL` | URL base da Zênite Financeira. |
| `BANK_ZENITE_TOKEN` | Token Bearer da Zênite. |
| `BANK_ZENITE_DEPRECATED` | Defina `true` para marcar a Zênite como deprecada e expor cabeçalhos de Deprecation. |
| `BANK_ZENITE_SUNSET_AT` | Data ISO 8601 para o cabeçalho `Sunset` ao descontinuar a Zênite. |

## Agendamento

Para manter as tabelas atualizadas, agende a execução do worker `agreements-sync` a cada 30 minutos (ex.: `0,30 * * * *`). O cron deve invocar o endpoint `POST /api/v1/agreements/providers/:providerId/sync` ou acionar uma fila com o job `agreements.sync.run`.

## Filas

Em ambientes com fila (BullMQ/Redis), utilize a fila `agreements-sync` para publicar jobs com a carga `{ providerId: '<id>' }`. Os consumidores devem chamar `runAgreementsSync` para permitir reuso das métricas e do circuito interno.

## Monitoramento

Os seguintes métricos foram adicionados ao `/metrics`:

- `agreements_sync_requests_total` — contador de execuções por provedor/resultado.
- `agreements_sync_failures_total` — contador de falhas por provedor/código.
- `agreements_sync_duration_ms` — summary com duração das execuções.
- `agreements_sync_last_success_timestamp` — timestamp da última sincronização bem-sucedida por provedor.

Utilize esses indicadores para configurar alertas de indisponibilidade ou latência elevada.

