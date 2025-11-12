# Relatórios de métricas operacionais

Este documento descreve o contrato dos novos endpoints de relatórios utilizados pelo dashboard da aplicação web para acompanhar o desempenho de leads e campanhas.

## Endpoint principal

`GET /api/reports/metrics`

### Parâmetros de query

| Parâmetro    | Obrigatório | Descrição                                                                                              |
|--------------|-------------|----------------------------------------------------------------------------------------------------------|
| `groupBy`    | não         | Dimensão de agregação (`agreement`, `campaign`, `instance`, `product`, `strategy`). Default: `agreement`. |
| `from`       | não         | Data/hora inicial em ISO 8601. Quando ausente, considera os últimos 7 dias.                              |
| `to`         | não         | Data/hora final em ISO 8601. Default: instante atual.                                                    |
| `limit`      | não         | Quantidade máxima de grupos no retorno (1-100). Default: 10.                                             |
| `campaignId` | não         | Filtra métricas para uma campanha específica.                                                            |
| `agreementId`| não         | Filtra por convênio (acordo) associado à campanha.                                                       |
| `instanceId` | não         | Filtra por instância do WhatsApp vinculada à campanha.                                                   |
| `productType`| não         | Filtra por tipo de produto configurado na campanha.                                                      |
| `strategy`   | não         | Filtra por estratégia cadastrada na campanha.                                                            |
| `marginType` | não         | Filtra por tipo de margem da campanha.                                                                   |

### Resposta (`200 OK`)

```json
{
  "success": true,
  "requestId": "b3a2...",
  "data": {
    "groupBy": "agreement",
    "period": {
      "from": "2024-04-01T00:00:00.000Z",
      "to": "2024-04-07T23:59:59.000Z"
    },
    "summary": {
      "total": 156,
      "allocated": 156,
      "contacted": 98,
      "won": 32,
      "lost": 12,
      "averageResponseSeconds": 1800,
      "conversionRate": 0.2051
    },
    "groups": [
      {
        "key": "agreement:saec",
        "dimension": "agreement",
        "label": "SAEC Goiânia",
        "metadata": {
          "campaignId": "campaign-1",
          "campaignName": "Campanha WhatsApp",
          "agreementId": "saec",
          "agreementName": "SAEC Goiânia",
          "instanceId": "instance-1",
          "instanceName": "Instância Norte",
          "productType": "consignado",
          "marginType": "gold",
          "strategy": "push"
        },
        "metrics": {
          "total": 90,
          "allocated": 90,
          "contacted": 60,
          "won": 20,
          "lost": 5,
          "averageResponseSeconds": 1500,
          "conversionRate": 0.2222
        },
        "breakdown": [
          {
            "date": "2024-04-06",
            "metrics": {
              "total": 40,
              "allocated": 40,
              "contacted": 28,
              "won": 10,
              "lost": 2,
              "averageResponseSeconds": 1200,
              "conversionRate": 0.25
            }
          }
        ]
      }
    ],
    "totalGroups": 5
  }
}
```

### Métricas retornadas

| Campo                    | Tipo   | Descrição                                                                                     |
|--------------------------|--------|-------------------------------------------------------------------------------------------------|
| `total`                  | número | Leads recebidos no período (registros em `lead_allocations`).                                   |
| `allocated`              | número | Leads ainda com status `allocated`.                                                             |
| `contacted`              | número | Leads com status `contacted`.                                                                   |
| `won`                    | número | Leads convertidos (`status = won`).                                                             |
| `lost`                   | número | Leads marcados como perdidos (`status = lost`).                                                 |
| `averageResponseSeconds` | número | Tempo médio (em segundos) entre recebimento e última atualização para leads não alocados.      |
| `conversionRate`         | número | Taxa de conversão (0 a 1) calculada como `won / total`.                                         |

> Quando não existem interações além da alocação inicial, `averageResponseSeconds` retorna `null`.

### Estrutura de grupos

Cada item em `groups[]` representa a agregação por valor da dimensão solicitada:

- `key`: identificador único interno (`<groupBy>:<valor>` ou marcador `unknown`).
- `dimension`: dimensão utilizada (`agreement`, `campaign`, `instance`, `product`, `strategy`).
- `label`: nome amigável exibido na UI.
- `metadata`: dados auxiliares disponíveis para drill-down (IDs de campanha, instância, convênio, produto, estratégia e margem).
- `metrics`: métricas consolidadas do grupo.
- `breakdown[]`: série diária com o mesmo conjunto de métricas, permitindo montar gráficos de tendência.

### Comportamento em falhas

- Erros de validação retornam `400` com `error.code = 'TENANT_REQUIRED'` ou `error.code = 'REPORTS_METRICS_FAILED'` conforme o caso.
- Em falhas internas (`500`), o campo `success` será `false` e nenhuma lista de grupos será enviada.

## Boas práticas de consumo

1. Utilize `groupBy` para alternar rapidamente entre visões de convênio, campanha, instância, produto ou estratégia.
2. Ajuste `from` e `to` para análises históricas maiores que 90 dias, respeitando os limites de volume.
3. Use `limit` para restringir o número de grupos retornados quando for renderizar gráficos de pizza ou tabelas mais compactas.
4. Aproveite `metadata` para construir links ou filtros secundários (ex.: navegar para a campanha ou instância específica).

## Histórico

- **Abr/2024** — Versão inicial do endpoint consolidando métricas de lead allocations por múltiplas dimensões.
