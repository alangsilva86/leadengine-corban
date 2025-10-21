import { z } from 'zod';

export const PollChoiceOptionSchema = z.object({
  id: z.string().min(1, 'Option id is required'),
  index: z.number().int().min(0).nullable().optional(),
  title: z.string().min(1).nullable().optional(),
  text: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
  selected: z.boolean().optional(),
  votes: z.number().int().min(0).optional(),
});

export const PollChoiceAggregatesSchema = z.object({
  totalVoters: z.number().int().min(0).default(0),
  totalVotes: z.number().int().min(0).default(0),
  optionTotals: z
    .record(z.string().min(1), z.number().int().min(0))
    .default({}),
});

export const PollChoiceSelectedOptionSchema = z
  .object({
    id: z.string().min(1, 'Option id is required'),
    title: z.string().nullable().optional(),
  })
  .passthrough();

export const PollChoiceEventSchema = z.object({
  pollId: z.string().min(1, 'pollId is required'),
  voterJid: z.string().min(1, 'voterJid is required'),
  messageId: z.string().min(1).optional(),
  selectedOptionIds: z.array(z.string().min(1)).optional(),
  selectedOptions: z.array(PollChoiceSelectedOptionSchema).optional(),
  options: z.array(PollChoiceOptionSchema).min(1),
  aggregates: PollChoiceAggregatesSchema,
  timestamp: z.string().optional().nullable(),
});

export const PollChoiceVoteSchema = z.object({
  optionIds: z.array(z.string().min(1)),
  selectedOptions: z.array(PollChoiceSelectedOptionSchema).default([]),
  messageId: z.string().nullable().optional(),
  timestamp: z.string().nullable().optional(),
});

export const PollChoiceStateSchema = z.object({
  pollId: z.string().min(1),
  options: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().nullable().optional(),
      index: z.number().int().nullable().optional(),
    })
  ),
  votes: z
    .record(z.string().min(1), PollChoiceVoteSchema)
    .default({}),
  aggregates: PollChoiceAggregatesSchema,
  brokerAggregates: PollChoiceAggregatesSchema.optional(),
  updatedAt: z.string(),
});

export type PollChoiceOptionPayload = z.infer<typeof PollChoiceOptionSchema>;
export type PollChoiceAggregatesPayload = z.infer<typeof PollChoiceAggregatesSchema>;
export type PollChoiceEventPayload = z.infer<typeof PollChoiceEventSchema>;
export type PollChoiceSelectedOptionPayload = z.infer<typeof PollChoiceSelectedOptionSchema>;
export type PollChoiceVoteEntry = z.infer<typeof PollChoiceVoteSchema>;
export type PollChoiceState = z.infer<typeof PollChoiceStateSchema>;
