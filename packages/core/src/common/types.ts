import { z } from 'zod';

// ============================================================================
// Base Types
// ============================================================================

export const EntityIdSchema = z.string().uuid();
export type EntityId = z.infer<typeof EntityIdSchema>;

export const TenantIdSchema = z.string().uuid();
export type TenantId = z.infer<typeof TenantIdSchema>;

export const TimestampSchema = z.date();
export type Timestamp = z.infer<typeof TimestampSchema>;

// ============================================================================
// Base Entity
// ============================================================================

export const BaseEntitySchema = z.object({
  id: EntityIdSchema,
  tenantId: TenantIdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type BaseEntity = z.infer<typeof BaseEntitySchema>;

// ============================================================================
// Result Pattern
// ============================================================================

export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export const success = <T>(data: T): Result<T> => ({ success: true, data });
export const failure = <E>(error: E): Result<never, E> => ({ success: false, error });

// ============================================================================
// Domain Events
// ============================================================================

export const DomainEventSchema = z.object({
  id: EntityIdSchema,
  type: z.string(),
  aggregateId: EntityIdSchema,
  aggregateType: z.string(),
  tenantId: TenantIdSchema,
  payload: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
  occurredAt: TimestampSchema,
  version: z.number().int().positive(),
});

export type DomainEvent = z.infer<typeof DomainEventSchema>;

// ============================================================================
// Pagination
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export const PaginatedResultSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  });

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

// ============================================================================
// Contact Information
// ============================================================================

export const PhoneNumberSchema = z.string().regex(/^\+[1-9]\d{1,14}$/);
export type PhoneNumber = z.infer<typeof PhoneNumberSchema>;

export const EmailSchema = z.string().email();
export type Email = z.infer<typeof EmailSchema>;

export const DocumentSchema = z.string().min(1);
export type Document = z.infer<typeof DocumentSchema>;

// ============================================================================
// Communication Channels
// ============================================================================

export const ChannelTypeSchema = z.enum([
  'WHATSAPP',
  'EMAIL',
  'SMS',
  'VOICE',
  'CHAT',
  'SOCIAL',
]);

export type ChannelType = z.infer<typeof ChannelTypeSchema>;

// ============================================================================
// Message Types
// ============================================================================

export const MessageTypeSchema = z.enum([
  'TEXT',
  'IMAGE',
  'AUDIO',
  'VIDEO',
  'DOCUMENT',
  'LOCATION',
  'CONTACT',
  'TEMPLATE',
]);

export type MessageType = z.infer<typeof MessageTypeSchema>;

export const MessageDirectionSchema = z.enum(['INBOUND', 'OUTBOUND']);
export type MessageDirection = z.infer<typeof MessageDirectionSchema>;

// ============================================================================
// Status Types
// ============================================================================

export const GenericStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'PENDING',
  'SUSPENDED',
  'DELETED',
]);

export type GenericStatus = z.infer<typeof GenericStatusSchema>;

// ============================================================================
// Error Types
// ============================================================================

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', { resource, id });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden access') {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ============================================================================
// Repository Pattern
// ============================================================================

export interface Repository<T extends BaseEntity> {
  findById(id: EntityId, tenantId: TenantId): Promise<T | null>;
  findMany(filters: Partial<T>, pagination: Pagination): Promise<PaginatedResult<T>>;
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: EntityId, tenantId: TenantId, updates: Partial<T>): Promise<T>;
  delete(id: EntityId, tenantId: TenantId): Promise<void>;
}

// ============================================================================
// Event Bus
// ============================================================================

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
  unsubscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}

// ============================================================================
// Use Case Pattern
// ============================================================================

export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<Result<TOutput>>;
}

export interface Query<TInput, TOutput> {
  execute(input: TInput): Promise<Result<TOutput>>;
}

export interface Command<TInput, TOutput = void> {
  execute(input: TInput): Promise<Result<TOutput>>;
}
