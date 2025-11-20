import { Prisma } from '@prisma/client';

export interface QueueInput {
  name: string;
  description?: string | null;
  color?: string | null;
  isActive?: boolean;
  orderIndex?: number;
  settings?: Prisma.JsonObject | null;
}

export type QueueUpdateInput = Partial<QueueInput>;

export interface QueueReorderItem {
  id: string;
  orderIndex: number;
}

export interface QueueEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  orderIndex: number;
  settings: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}
