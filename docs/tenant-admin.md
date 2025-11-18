# Tenant Management API (MVP)

Este módulo introduz uma camada mínima para governança de tenants, pronta para
ser estendida com planos, features e capabilities específicas em tarefas
futuras.

## Endpoints

Todos os endpoints ficam sob `/api/tenant-admin/tenants` e exigem:

1. Autenticação padrão (`Authorization: Bearer <token>`).
2. Header administrativo `x-platform-admin-token` (ou `x-platform-admin`).
   - Em desenvolvimento, envie `true` ou `1`.
   - Em produção, defina `PLATFORM_ADMIN_TOKEN` e envie exatamente o mesmo valor.

| Método | Rota                              | Descrição                                  |
| ------ | --------------------------------- | ------------------------------------------ |
| POST   | `/api/tenant-admin/tenants`       | Cria um tenant (`name`, `slug`, `settings`). |
| GET    | `/api/tenant-admin/tenants`       | Lista tenants com paginação/filtros simples. |
| GET    | `/api/tenant-admin/tenants/:id`   | Recupera um tenant específico.             |
| PATCH  | `/api/tenant-admin/tenants/:id`   | Atualiza `name`, `slug` ou `settings`.      |
| PATCH  | `/api/tenant-admin/tenants/:id/toggle-active` | Ativa/desativa o tenant.            |

### Payloads

- `settings` é um JSON arbitrário pensado para armazenar preferências, flags
  simples e futuros metadados de capabilities.
- `slug` precisa estar no formato `^[a-z0-9]+(?:-[a-z0-9]+)*$` e é normalizado
  no serviço para evitar conflitos.
- Paginação aceita `page`, `limit`, `search`, `slug` e `isActive` via query.

## Extensibilidade planejada

- O domínio de `Tenant` expõe o campo `planSnapshot`, reservado para anexar
  metadados de plano e feature flags quando os módulos de Plan/Feature/Capability
  forem adicionados.
- O repositório utiliza interfaces (`ITenantRepository`) para permitir testes e
  trocar o backend de dados caso o módulo migre para outro serviço.
- O middleware `requirePlatformAdmin` é propositalmente simples e documentado:
  será substituído por um provedor dedicado assim que o painel de operadores
  existir.
