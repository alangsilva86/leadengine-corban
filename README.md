# 🎯 Ticketz LeadEngine - Sistema Híbrido de Gestão

> **Sistema moderno de gestão de tickets e leads com integrações WhatsApp e URA**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

## 📋 Visão Geral

O **Ticketz LeadEngine** é uma solução completa que combina o melhor dos projetos **Ticketz** e **LeadEngine**, oferecendo:

- 🎫 **Sistema de Tickets** completo e moderno
- 👥 **Gestão de Leads** com automação
- 📱 **Integração WhatsApp** via Baileys
- ☎️ **Sistema URA** para telefonia
- 🏢 **Multi-tenant** com isolamento completo
- ⚡ **Tempo Real** com WebSockets
- 🎨 **Interface Moderna** com React e Tailwind

## 🏗️ Arquitetura

### Monorepo Structure
```
ticketz-leadengine/
├── apps/
│   ├── api/          # Backend API (Node.js + TypeScript)
│   ├── web/          # Frontend Web (React + Vite)
│   └── admin/        # Painel Admin (futuro)
├── packages/
│   ├── core/         # Domínios e regras de negócio
│   ├── shared/       # Utilitários compartilhados
│   ├── storage/      # Camada de persistência
│   └── integrations/ # WhatsApp, URA e outras integrações
└── docs/             # Documentação
```

### Stack Tecnológica

#### Backend
- **Node.js 18+** com TypeScript
- **Express.js** para API REST
- **Socket.IO** para tempo real
- **Prisma** para ORM (preparado)
- **JWT** para autenticação
- **Winston** para logs

#### Frontend
- **React 18** com Vite
- **Tailwind CSS** + **shadcn/ui**
- **React Query** para estado servidor
- **Recharts** para gráficos
- **Lucide Icons** para ícones

#### Integrações
- **Baileys** para WhatsApp
- **Axios** para APIs externas
- **QR Code** para pareamento

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 18+
- pnpm (recomendado) ou npm
- Git

### 1. Clone o Repositório
```bash
git clone <repository-url>
cd ticketz-leadengine
```

### 2. Instale as Dependências
```bash
# Usando pnpm (recomendado)
pnpm install

# Ou usando npm
npm install
```

### 3. Configure as Variáveis de Ambiente

#### Backend (apps/api/.env)
```env
# Servidor
PORT=4000
NODE_ENV=development

# Frontend URL
FRONTEND_URL=http://localhost:5173
# Lista adicional de domínios autorizados (separados por vírgula)
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
AUTH_ALLOW_JWT_FALLBACK=true

# Database (quando configurar)
DATABASE_URL="postgresql://user:password@localhost:5432/ticketz"

# WhatsApp
WHATSAPP_SESSIONS_PATH=./sessions

# URA
URA_API_URL=https://api.ura-provider.com
URA_API_KEY=your-ura-api-key

# Logs
LOG_LEVEL=info
```

> **Dica:** Defina `CORS_ALLOWED_ORIGINS` com uma lista de domínios adicionais (separados por vírgula) quando precisar liberar múltiplos frontends hospedados simultaneamente. O valor de `FRONTEND_URL` continua sendo utilizado como origem principal.
> **Demo:** `AUTH_ALLOW_JWT_FALLBACK` permite aceitar tokens JWT válidos mesmo quando o usuário não existe no banco (útil em ambientes de demonstração). Defina como `false` em produção para exigir usuários persistidos.

#### Frontend (apps/web/.env.local)
```env
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
```

### 4. Execute o Projeto

#### Desenvolvimento
```bash
# Backend
cd apps/api
pnpm dev

# Frontend (em outro terminal)
cd apps/web
pnpm dev
```

#### Docker Compose
Para subir Postgres, Redis, API e Web com Docker Compose:

```bash
cd ticketz-leadengine
docker compose up --build

# incluir Nginx (proxy) quando for testar produção
docker compose --profile production up --build
```

Antes de rodar, preencha o arquivo `.env` na raiz com as credenciais reais. Consulte [`docs/docker.md`](docs/docker.md) para detalhes.

#### Build para Produção
```bash
# Build completo
pnpm run build

# Ou individual
cd apps/api && npm run build
cd apps/web && npm run build
```

## 📱 Funcionalidades

### 🎫 Sistema de Tickets
- ✅ Criação e gestão de tickets
- ✅ Atribuição automática de agentes
- ✅ Status e prioridades
- ✅ Histórico completo
- ✅ Tempo real via WebSocket

### 👥 Gestão de Leads
- ✅ Captura de leads
- ✅ Qualificação automática
- ✅ Pipeline de vendas
- ✅ Relatórios e métricas
- ✅ Integração com CRM

### 📱 WhatsApp Integration
- ✅ Múltiplas instâncias
- ✅ QR Code para pareamento
- ✅ Envio de mensagens e mídias
- ✅ Webhooks para recebimento
- ✅ Status de conexão em tempo real

### ☎️ Sistema URA
- ✅ Fluxos de atendimento
- ✅ Menu interativo (DTMF)
- ✅ Reconhecimento de voz
- ✅ Transferência de chamadas
- ✅ Gravação de chamadas

### 🏢 Multi-tenant
- ✅ Isolamento completo de dados
- ✅ Configurações por tenant
- ✅ Usuários e permissões
- ✅ Customização de interface

## 🔌 APIs e Integrações

### Endpoints Principais

#### Autenticação
```
POST /api/auth/login
POST /api/auth/register *(requer usuário autenticado com permissão de administração)*
GET  /api/auth/me
PUT  /api/auth/profile
PUT  /api/auth/password
POST /api/auth/logout
```

#### Tickets
```
GET    /api/tickets
POST   /api/tickets
GET    /api/tickets/:id
PUT    /api/tickets/:id
DELETE /api/tickets/:id
```

#### Leads
```
GET    /api/leads
POST   /api/leads
GET    /api/leads/:id
PUT    /api/leads/:id
DELETE /api/leads/:id
```

#### Lead Engine
```
GET    /api/lead-engine/campaigns?agreementId={id}&status=ACTIVE,PAUSED
POST   /api/lead-engine/campaigns
GET    /api/lead-engine/agreements
GET    /api/lead-engine/agreements/available
```

> `status` aceita múltiplos valores separados por vírgula ou repetidos na query string
> (por exemplo: `status=ACTIVE,PAUSED` ou `status=ACTIVE&status=PAUSED`).
> O payload de criação exige `agreementId`, `instanceId` e `name`, além de um `status`
> opcional (`ACTIVE`, `PAUSED` ou `COMPLETED`).

#### WhatsApp
```
GET    /api/integrations/whatsapp/instances
POST   /api/integrations/whatsapp/instances
POST   /api/integrations/whatsapp/instances/:id/start
POST   /api/integrations/whatsapp/instances/:id/stop
GET    /api/integrations/whatsapp/instances/:id/qr
POST   /api/integrations/whatsapp/instances/:id/send
```

#### URA
```
GET    /api/integrations/ura/flows
POST   /api/integrations/ura/flows
POST   /api/integrations/ura/calls
GET    /api/integrations/ura/calls/:id
POST   /api/integrations/ura/calls/:id/hangup
```

### WebSocket Events
```javascript
// Cliente se conecta
socket.emit('join-tenant', tenantId);
socket.emit('join-user', userId);

// Eventos de tickets
socket.on('ticket.created', (ticket) => {});
socket.on('ticket.updated', (ticket) => {});
socket.on('ticket.assigned', (assignment) => {});

// Eventos de mensagens
socket.on('message.received', (message) => {});
socket.on('message.sent', (message) => {});

// Eventos WhatsApp
socket.on('whatsapp.connected', (instance) => {});
socket.on('whatsapp.qr', (qrData) => {});
```

## 🎨 Interface do Usuário

### Dashboard Principal
- 📊 Métricas em tempo real
- 📈 Gráficos de performance
- 🎯 KPIs principais
- 📋 Tickets recentes
- 🔔 Notificações

### Gestão de Tickets
- 📝 Lista com filtros avançados
- 🏷️ Tags e categorias
- ⏱️ SLA e tempo de resposta
- 💬 Chat integrado
- 📎 Anexos e mídias

### WhatsApp Manager
- 📱 Múltiplas instâncias
- 🔗 QR Code para conexão
- 💬 Chat em tempo real
- 📊 Estatísticas de mensagens
- ⚙️ Configurações avançadas

## 🔧 Desenvolvimento

### Estrutura de Packages

#### @ticketz/core
Contém os domínios principais e regras de negócio:
- `tickets/` - Domínio de tickets
- `leads/` - Domínio de leads
- `contacts/` - Domínio de contatos
- `common/` - Tipos e utilitários comuns

#### @ticketz/integrations
Integrações com serviços externos:
- `whatsapp/` - Provider Baileys
- `telephony/` - Provider URA
- `utils/` - Utilitários compartilhados

#### @ticketz/shared
Código compartilhado entre apps:
- `logger/` - Sistema de logs
- `config/` - Configurações
- `utils/` - Utilitários gerais

### Scripts Disponíveis

```bash
# Desenvolvimento
pnpm run dev          # Inicia todos os serviços
pnpm run dev:api      # Apenas API
pnpm run dev:web      # Apenas frontend

# Build
pnpm run build        # Build completo
pnpm run build:api    # Build apenas API
pnpm run build:web    # Build apenas frontend

# Testes
pnpm run test         # Executa todos os testes
pnpm run test:watch   # Testes em modo watch

# Linting
pnpm run lint         # ESLint
pnpm run lint:fix     # ESLint com correção automática

# Type checking
pnpm run type-check   # Verificação de tipos TypeScript
```

## 🐳 Docker

### Desenvolvimento
```bash
# Build das imagens
docker-compose build

# Subir os serviços
docker-compose up -d

# Logs
docker-compose logs -f
```

### Produção
```bash
# Build para produção
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Monitoramento

### Health Checks
```bash
# API Health
curl http://localhost:4000/health

# Integrações Health
curl http://localhost:4000/api/integrations/health
```

### Logs
```bash
# API logs
tail -f apps/api/logs/app.log

# WhatsApp logs
tail -f apps/api/logs/whatsapp.log

# URA logs
tail -f apps/api/logs/ura.log
```

## 🔒 Segurança

- 🔐 **JWT Authentication** com controle de permissões por tenant
- 🛡️ **Rate Limiting** para APIs
- 🔒 **CORS** configurado
- 🛡️ **Helmet** para headers de segurança
- 🔐 **Validação** de entrada com Zod
- 🏢 **Isolamento** multi-tenant

## 🚀 Deploy

### Vercel (Frontend)
```bash
cd apps/web
vercel --prod
```

### Railway/Heroku (Backend)
```bash
cd apps/api
# Configure as variáveis de ambiente
# Deploy via Git push
```

### VPS/Servidor Próprio
```bash
# Clone o repositório
git clone <repo>
cd ticketz-leadengine

# Build
pnpm install
pnpm run build

# Configure PM2
pm2 start ecosystem.config.js
```

## 📈 Roadmap

### Versão 1.1
- [ ] Sistema de relatórios avançados
- [ ] Integração com CRM externo
- [ ] API de webhooks
- [ ] Sistema de templates

### Versão 1.2
- [ ] App mobile (React Native)
- [ ] Integração com Telegram
- [ ] IA para classificação automática
- [ ] Sistema de chatbots

### Versão 2.0
- [ ] Microserviços
- [ ] Kubernetes
- [ ] Sistema de plugins
- [ ] Marketplace de integrações

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🆘 Suporte

- 📧 Email: suporte@ticketz-leadengine.com
- 💬 Discord: [Servidor da Comunidade](https://discord.gg/ticketz)
- 📖 Documentação: [docs.ticketz-leadengine.com](https://docs.ticketz-leadengine.com)
- 🐛 Issues: [GitHub Issues](https://github.com/ticketz-leadengine/issues)

---

**Desenvolvido com ❤️ pela equipe Ticketz LeadEngine**
