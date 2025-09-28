# Ticketz LeadEngine - Versão Corrigida e Otimizada

Este é o projeto Ticketz LeadEngine após a aplicação de uma série de correções, melhorias e otimizações para garantir seu funcionamento completo e estável. Este documento fornece as instruções necessárias para configurar e executar o projeto.

## 🚀 Visão Geral das Melhorias

- **✅ Configuração Unificada**: Variáveis de ambiente centralizadas e consistentes.
- **✅ Integração Real**: Conexão com os serviços reais de Lead Engine e WhatsApp.
- **✅ Persistência de Dados**: Implementação completa com PostgreSQL e Prisma.
- **✅ Autenticação Robusta**: Sistema de login seguro com JWT, bcrypt e controle de acesso (RBAC).
- **✅ Arquitetura Monorepo Corrigida**: Resolução de módulos e dependências ajustada.
- **✅ Docker Otimizado**: Dockerfiles multi-stage para builds mais rápidos e imagens menores.
- **✅ Deploy Automatizado**: Script de deploy para ambiente de produção.

## 🛠️ Pré-requisitos

- **Docker**: [Instruções de instalação](https://docs.docker.com/get-docker/)
- **Docker Compose**: [Instruções de instalação](https://docs.docker.com/compose/install/)
- **Node.js**: v18 ou superior (para scripts locais)
- **pnpm**: v8 ou superior (`npm install -g pnpm`)

## ⚙️ Configuração do Ambiente

### 1. **Clone o repositório**

```bash
git clone <url-do-repositorio>
cd ticketz-corrigido
```

### 2. **Configure as variáveis de ambiente**

Copie o arquivo de exemplo `.env.production` para `.env` e ajuste as variáveis conforme necessário, especialmente as senhas e segredos.

```bash
cp .env.production .env
```

**Atenção**: Altere as senhas e segredos no arquivo `.env` antes de iniciar em produção.

## 🚀 Executando em Desenvolvimento

### 1. **Instale as dependências**

```bash
pnpm install
```

### 2. **Inicie os serviços com Docker Compose**

Este comando irá iniciar o banco de dados, o Redis e a API em modo de desenvolvimento com hot-reload.

```bash
docker-compose up -d
```

### 3. **Execute as migrações e o seed do banco**

Na primeira vez, você precisa criar as tabelas e popular o banco com dados iniciais.

```bash
cd apps/api
pnpm db:push
pnpm db:seed
cd ../..
```

### 4. **Inicie o frontend**

Em um terminal separado, inicie a aplicação web.

```bash
pnpm web:dev
```

- **Frontend**: http://localhost:5173
- **API**: http://localhost:4000
- **Prisma Studio** (para visualizar o banco): `cd apps/api && pnpm db:studio`

## 📦 Executando em Produção

Para o ambiente de produção, utilize o script de deploy automatizado.

### 1. **Verifique o arquivo `.env`**

Certifique-se de que o arquivo `.env` está configurado com os valores de produção.

### 2. **Execute o script de deploy**

O script irá fazer o build das imagens, executar as migrações e iniciar os serviços.

```bash
./scripts/deploy.sh
```

**Opções do script de deploy:**

- `--skip-backup`: Pula o backup do banco de dados.
- `--cleanup-images`: Limpa imagens Docker antigas antes do build.

## 📂 Estrutura do Projeto

- `apps/api`: Backend da aplicação (Node.js, Express, Prisma)
- `apps/web`: Frontend da aplicação (React, Vite, TailwindCSS)
- `packages/core`: Tipos e interfaces compartilhados
- `packages/shared`: Funções e utilitários compartilhados
- `packages/storage`: Lógica de persistência (agora com Prisma)
- `packages/integrations`: Clientes para serviços externos (Lead Engine, WhatsApp)
- `prisma`: Schema e seed do banco de dados
- `scripts`: Scripts de deploy e inicialização

## ✅ Credenciais de Acesso (Seed)

- **Usuário Admin**: `admin@ticketz.com` / `admin123`
- **Usuário Agente**: `agente@ticketz.com` / `agent123`

## 📖 Documentação Adicional

- **Propostas de Soluções**: `propostas-solucoes-ticketz.md`
- **Análise de Problemas**: `analise-problemas-ticketz.md`

---
