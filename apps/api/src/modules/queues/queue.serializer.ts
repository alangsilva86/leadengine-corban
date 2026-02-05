import { Prisma } from '@prisma/client';

import type { QueueEntity, QueueInput, QueueReorderItem, QueueUpdateInput } from './queue.types';

const hasOwn = Object.prototype.hasOwnProperty;

const sanitizeOptionalString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeSettings = (value: unknown): Prisma.JsonObject | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }

  return {};
};

export class QueueSerializer {
  buildCreateInput(body: Record<string, unknown>): QueueInput {
    const input: QueueInput = {
      name: String(body.name ?? '').trim(),
    };

    const description = sanitizeOptionalString(body.description);
    if (description !== undefined) {
      input.description = description ?? null;
    }

    const color = sanitizeOptionalString(body.color);
    if (color !== undefined) {
      input.color = color ?? null;
    }

    if (typeof body.isActive === 'boolean') {
      input.isActive = body.isActive;
    }

    if (typeof body.orderIndex === 'number' && Number.isFinite(body.orderIndex)) {
      input.orderIndex = body.orderIndex;
    }

    const settings = normalizeSettings(body.settings);
    if (settings !== undefined) {
      input.settings = settings ?? null;
    }

    return input;
  }

  buildUpdateInput(body: Record<string, unknown>): { updates: QueueUpdateInput; hasUpdates: boolean } {
    const updates: QueueUpdateInput = {};

    if (hasOwn.call(body, 'name')) {
      updates.name = String((body as { name?: string }).name ?? '').trim();
    }

    if (hasOwn.call(body, 'description')) {
      updates.description = sanitizeOptionalString((body as { description?: string }).description) ?? null;
    }

    if (hasOwn.call(body, 'color')) {
      const normalized = sanitizeOptionalString((body as { color?: string }).color);
      updates.color = normalized ?? null;
    }

    if (hasOwn.call(body, 'isActive')) {
      updates.isActive = Boolean((body as { isActive?: boolean }).isActive);
    }

    if (hasOwn.call(body, 'orderIndex')) {
      const value = (body as { orderIndex?: unknown }).orderIndex;
      if (typeof value === 'number' && Number.isFinite(value)) {
        updates.orderIndex = value;
      }
    }

    if (hasOwn.call(body, 'settings')) {
      const normalized = normalizeSettings((body as { settings?: Record<string, unknown> | null }).settings);
      if (normalized !== undefined) {
        updates.settings = normalized ?? null;
      }
    }

    return { updates, hasUpdates: Object.keys(updates).length > 0 };
  }

  buildReorderItems(body: Record<string, unknown>): QueueReorderItem[] {
    const items = Array.isArray((body as { items?: QueueReorderItem[] }).items)
      ? ((body as { items: QueueReorderItem[] }).items || [])
      : [];

    return items.filter(Boolean).map((item) => ({
      id: String(item.id),
      orderIndex: Number(item.orderIndex),
    }));
  }

  serialize(queue: QueueEntity): QueueEntity {
    return {
      id: queue.id,
      tenantId: queue.tenantId,
      name: queue.name,
      description: queue.description,
      color: queue.color,
      isActive: queue.isActive,
      orderIndex: queue.orderIndex,
      settings: queue.settings ?? null,
      createdAt: queue.createdAt,
      updatedAt: queue.updatedAt,
    };
  }

  serializeList(queues: QueueEntity[]): { items: QueueEntity[]; total: number } {
    return {
      items: queues.map((queue) => this.serialize(queue)),
      total: queues.length,
    };
  }
}
