# Arquitetura Híbrida: Ticketz + Lead Engine

## 🚀 Visão Geral

Esta arquitetura combina as funcionalidades robustas do **Ticketz** com a estrutura moderna e escalável do **Lead Engine**, criando um sistema completo e flexível para gestão de tickets, leads e CRM.

## 🏗️ Estrutura do Monorepo

```
ticketz-leadengine/
├── apps/
│   ├── api/                    # API REST + GraphQL
│   ├── web/                    # Frontend React/Next.js
│   └── admin/                  # Painel administrativo
├── packages/
│   ├── core/                   # Domínio e casos de uso
│   ├── integrations/           # Integrações externas
│   ├── shared/                 # Código compartilhado
│   └── storage/                # Persistência de dados
├── package.json                # Configurações do monorepo
└── pnpm-workspace.yaml         # Configuração do pnpm
```

## 📦 Packages

### **`packages/core`**

O coração do sistema, contendo toda a lógica de negócio e regras de domínio, completamente isolado de frameworks e tecnologias externas.

```
core/
├── tickets/           # Sistema de tickets
├── leads/             # Gestão de leads
├── contacts/          # CRM de contatos
├── campaigns/         # Campanhas de marketing
├── analytics/         # Métricas e relatórios
└── integrations/      # Orquestração de integrações
```

### **`packages/integrations`**

Implementações concretas para serviços externos, como gateways de comunicação e APIs de terceiros.

```
integrations/
├── whatsapp/         # WhatsApp (Baileys)
├── telephony/        # URA e telefonia
├── email/            # Email marketing
└── crm/              # CRMs externos
```

### **`packages/shared`**

Código utilitário compartilhado entre todos os pacotes e aplicações, como loggers, event bus e configurações.

```
shared/
├── events/           # Event bus (e.g., RabbitMQ, Redis)
├── queue/            # Sistema de filas (e.g., BullMQ)
├── auth/             # Autenticação e autorização
├── validation/       # Schemas de validação (Zod)
└── utils/            # Utilitários gerais
```

### **`packages/storage`**

Responsável pela persistência de dados, incluindo repositórios, migrations e seeds.

```
storage/
├── repositories/     # Repositórios (Prisma, Drizzle)
├── migrations/       # Migrations de banco de dados
└── seeds/            # Seeds para dados iniciais
```

## 📱 Aplicações (Apps)

### **`apps/api`**

- **API principal** que expõe os casos de uso do domínio.
- **Tecnologias**: Express/Fastify, GraphQL (Apollo/Yoga), TypeScript.
- **Responsabilidades**: Autenticação, roteamento, validação de entrada/saída, injeção de dependências.

### **`apps/web`**

- **Interface do usuário** principal para clientes e agentes.
- **Tecnologias**: Next.js/React, Tailwind CSS, React Query.
- **Responsabilidades**: Apresentação de dados, interação com o usuário, consumo da API.

### **`apps/admin`**

- **Painel administrativo** para configuração e monitoramento.
- **Tecnologias**: React/Vite, Material-UI/Ant Design.
- **Responsabilidades**: Gestão de tenants, usuários, configurações globais.

## 🎯 Princípios de Design

- **Domain-Driven Design (DDD)**: Foco no domínio de negócio.
- **Clean Architecture**: Separação clara de responsabilidades.
- **Event-Driven Architecture**: Comunicação assíncrona e escalável.
- **API-First**: Contratos bem definidos entre frontend e backend.
- **Test-Driven Development (TDD)**: Qualidade e confiabilidade desde o início.

## 🔗 Fluxo de Dados (Exemplo: Novo Ticket via WhatsApp)

1.  **`integrations/whatsapp`**: Recebe uma nova mensagem via webhook do Baileys.
2.  **`integrations/whatsapp`**: Publica um evento `MessageReceivedEvent` no **`shared/events`** (Event Bus).
3.  **`core/tickets`**: Um worker (ou handler) inscrito no evento `MessageReceivedEvent` processa a mensagem.
4.  **`core/tickets`**: Utiliza o `ContactsService` para encontrar ou criar um contato.
5.  **`core/tickets`**: Utiliza o `TicketsService` para criar um novo ticket ou adicionar a mensagem a um ticket existente.
6.  **`core/tickets`**: Publica um evento `TicketCreatedEvent` ou `TicketUpdatedEvent`.
7.  **`apps/api`**: Envia uma notificação em tempo real para a **`apps/web`** via WebSocket.
8.  **`apps/web`**: A interface do usuário é atualizada em tempo real para exibir o novo ticket/mensagem.

## ✅ Benefícios

- **Manutenibilidade**: Código organizado e fácil de entender.
- **Escalabilidade**: Componentes podem ser escalados independentemente.
- **Flexibilidade**: Fácil de adicionar novas funcionalidades e integrações.
- **Testabilidade**: Domínio isolado facilita testes unitários.
- **Reutilização**: Código compartilhado entre múltiplas aplicações.

---

**Próximo passo**: Implementar a estrutura base dos pacotes e configurar as ferramentas de desenvolvimento.
