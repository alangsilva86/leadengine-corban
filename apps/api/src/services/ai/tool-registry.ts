export type AiToolExecutionContext = {
  tenantId: string;
  conversationId: string;
};

export type AiToolExecutionResult = {
  ok: boolean;
  result?: unknown;
  error?: string;
};

export type AiToolHandler = (
  params: Record<string, unknown>,
  context: AiToolExecutionContext
) => Promise<unknown>;

export type AiToolDefinition = {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler?: AiToolHandler;
};

const registry = new Map<string, AiToolDefinition>();

export const registerTool = (tool: AiToolDefinition): void => {
  registry.set(tool.name, tool);
};

export const getRegisteredTools = (): AiToolDefinition[] => {
  return Array.from(registry.values());
};

export const clearRegisteredTools = (): void => {
  registry.clear();
};

export const executeTool = async (
  toolName: string,
  params: Record<string, unknown>,
  context: AiToolExecutionContext
): Promise<AiToolExecutionResult> => {
  const tool = registry.get(toolName);
  if (!tool || !tool.handler) {
    return {
      ok: false,
      error: `Ferramenta ${toolName} não registrada no backend`,
    };
  }

  try {
    const result = await tool.handler(params, context);
    return {
      ok: true,
      result,
    };
  } catch (error) {
    return {
      ok: false,
      error: (error as Error).message ?? 'Falha ao executar ferramenta',
    };
  }
};
