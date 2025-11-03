# Correção do Erro 400 na Rota /api/ai/mode

## Problema Identificado

O frontend estava enviando valores de modo de IA no formato `assist`, `auto` e `manual`, enquanto o backend esperava os valores `COPILOTO`, `IA_AUTO` e `HUMANO`. Isso causava erro 400 (Bad Request) ao tentar alterar o modo de IA.

### Logs do Erro

```
POST https://leadengine-corban.up.railway.app/api/ai/mode 400 (Bad Request)
```

## Causa Raiz

Desalinhamento entre os valores aceitos pelo validador do backend e os valores enviados pelo frontend:

**Frontend** (`apps/web/src/features/chat/components/ConversationArea/aiModes.js`):
- `assist` - IA assistida
- `auto` - IA autônoma  
- `manual` - Agente no comando

**Backend** (`apps/api/src/routes/ai.ts`):
- `COPILOTO` - IA assistida
- `IA_AUTO` - IA autônoma
- `HUMANO` - Agente no comando

## Solução Implementada

### 1. Normalização de Modos (Backend)

Adicionada função `normalizeModeFromFrontend()` que aceita ambos os formatos:

```typescript
const normalizeModeFromFrontend = (mode: string): AiAssistantMode | null => {
  const normalized = mode.trim().toLowerCase();
  
  // Aceitar valores do frontend
  if (normalized === 'assist') return 'COPILOTO';
  if (normalized === 'auto' || normalized === 'autonomous') return 'IA_AUTO';
  if (normalized === 'manual') return 'HUMANO';
  
  // Aceitar valores do backend (case-insensitive)
  if (normalized === 'copiloto') return 'COPILOTO';
  if (normalized === 'ia_auto') return 'IA_AUTO';
  if (normalized === 'humano') return 'HUMANO';
  
  return null;
};
```

### 2. Conversão para Frontend

Adicionada função `modeToFrontend()` para retornar valores no formato esperado pelo frontend:

```typescript
const modeToFrontend = (mode: AiAssistantMode): string => {
  if (mode === 'COPILOTO') return 'assist';
  if (mode === 'IA_AUTO') return 'auto';
  if (mode === 'HUMANO') return 'manual';
  return 'assist'; // fallback
};
```

### 3. Atualização dos Validadores

O validador foi atualizado para aceitar qualquer string e validar usando a função de normalização:

```typescript
const modeValidators = [
  body('mode')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Modo é obrigatório')
    .custom((value) => {
      const normalized = normalizeModeFromFrontend(value);
      if (!normalized) {
        throw new Error('Modo inválido: use assist/auto/manual ou IA_AUTO/COPILOTO/HUMANO.');
      }
      return true;
    }),
  body('queueId').optional({ nullable: true }).isString().trim(),
];
```

### 4. Atualização dos Endpoints

**GET /api/ai/mode**: Retorna o modo no formato do frontend
**POST /api/ai/mode**: Aceita ambos os formatos e retorna no formato do frontend

### 5. Testes Atualizados

Adicionados testes para validar:
- Aceitação de valores do frontend (`assist`, `auto`, `manual`)
- Aceitação de valores do backend (`COPILOTO`, `IA_AUTO`, `HUMANO`)
- Rejeição de valores inválidos
- Retorno correto no formato do frontend

## Arquivos Modificados

1. `apps/api/src/routes/ai.ts` - Lógica de normalização e conversão
2. `apps/api/src/routes/__tests__/ai.spec.ts` - Testes atualizados

## Compatibilidade

A solução mantém **retrocompatibilidade total**:
- Frontend antigo continua funcionando (valores `assist`, `auto`, `manual`)
- Backend aceita valores antigos (`COPILOTO`, `IA_AUTO`, `HUMANO`)
- Novos clientes podem usar qualquer formato

## Testes

Execute os testes com:

```bash
./test-ai-mode.sh
```

Ou manualmente:

```bash
pnpm --filter @ticketz/api test -- ai.spec.ts
```

## Resultado Esperado

Após o deploy:
- ✅ Erro 400 corrigido
- ✅ Frontend pode alternar entre modos de IA sem erros
- ✅ Compatibilidade mantida com código existente
- ✅ Testes passando
