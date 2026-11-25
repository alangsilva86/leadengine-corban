import { param, query } from 'express-validator';

// Formato 8-4-4-4-12 sem exigir versão/variante RFC (mesmo critério do antigo isUUID('loose')).
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cuidRegex = /^c[0-9a-z]{24}$/i;

export const isUuidOrCuid = (value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim();
  return uuidRegex.test(normalized) || cuidRegex.test(normalized);
};

export const validateTicketId = (value: unknown): true => {
  if (!isUuidOrCuid(value)) {
    throw new Error('Ticket ID must be a valid UUID or CUID');
  }
  return true;
};

/** Validador para IDs de entidades (usuário, fila…): o banco usa cuid; UUID é aceito por compatibilidade. */
export const validateEntityId = (label: string) => (value: unknown): true => {
  if (!isUuidOrCuid(value)) {
    throw new Error(`${label} must be a valid CUID or UUID`);
  }
  return true;
};

export const ensureTicketId = (value: unknown): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  throw new Error('Ticket ID missing');
};

export const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sortBy').optional().isString(),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

export const ticketIdParamValidation = [param('id').custom(validateTicketId)];
