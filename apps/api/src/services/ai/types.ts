import { z } from 'zod';

export const AiModeSchema = z.enum(['manual', 'assist', 'auto']);
export type AiMode = z.infer<typeof AiModeSchema>;

export const AiConversationMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant', 'system']).default('user'),
    content: z.string().min(1),
    timestamp: z.string().datetime().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type AiConversationMessage = z.infer<typeof AiConversationMessageSchema>;

export const AiToolCallSchema = z
  .object({
    name: z.string(),
    arguments: z.record(z.string(), z.unknown()).optional(),
    result: z.unknown().optional(),
  })
  .strict();

export type AiToolCall = z.infer<typeof AiToolCallSchema>;

export const AiSuggestionSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    rationale: z.string().optional(),
  })
  .strict();

export type AiSuggestion = z.infer<typeof AiSuggestionSchema>;

export const AiReplySchema = z
  .object({
    id: z.string(),
    role: z.literal('assistant'),
    content: z.string(),
    createdAt: z.string().datetime(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type AiReply = z.infer<typeof AiReplySchema>;

export const AiMemorySchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    contactId: z.string(),
    topic: z.string(),
    content: z.string(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    updatedAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
  })
  .strict();

export type AiMemory = z.infer<typeof AiMemorySchema>;

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AiReplyResult = {
  message: AiReply;
  context: {
    memories: AiMemory[];
    retrievedAt: string;
  };
  tools: AiToolCall[];
  usage: TokenUsage;
};

export type AiSuggestionResult = {
  suggestions: AiSuggestion[];
  generatedAt: string;
};

