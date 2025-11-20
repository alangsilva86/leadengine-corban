import type { Response } from 'express';

import { QueueSerializer } from './queue.serializer';
import type { QueueEntity, QueueUpdateInput } from './queue.types';

type QueueErrorPayload = {
  status: number;
  code: string;
  message: string;
};

export class QueueHttpSerializer {
  constructor(private readonly serializer = new QueueSerializer()) {}

  buildQueueUpdates(body: Record<string, unknown>):
    | { updates: QueueUpdateInput }
    | { error: QueueErrorPayload } {
    const { updates, hasUpdates } = this.serializer.buildUpdateInput(body);

    if (!hasUpdates) {
      return {
        error: {
          status: 400,
          code: 'QUEUE_NO_UPDATES',
          message: 'Informe ao menos um campo para atualizar.',
        },
      };
    }

    return { updates };
  }

  respondWithQueue(res: Response, queue: QueueEntity, status = 200): void {
    res.status(status).json({
      success: true,
      data: this.serializer.serialize(queue),
    });
  }

  respondWithQueueList(res: Response, queues: QueueEntity[]): void {
    res.json({
      success: true,
      data: this.serializer.serializeList(queues),
    });
  }

  respondWithDelete(res: Response): void {
    res.json({ success: true });
  }

  respondNotFound(res: Response, message = 'Fila não encontrada para o tenant informado.'): void {
    this.respondWithError(res, { status: 404, code: 'QUEUE_NOT_FOUND', message });
  }

  respondWithError(res: Response, error: QueueErrorPayload): void {
    res.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }
}
