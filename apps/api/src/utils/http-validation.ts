import type { Response } from 'express';
import type { ZodIssue } from 'zod';

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export class HandledError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor({
    status,
    code,
    message,
    details,
  }: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(message);
    this.name = 'HandledError';
    this.status = status;
    this.code = code;
    this.details = details;

    Object.setPrototypeOf(this, HandledError.prototype);
  }
}

export const formatZodIssues = (issues: ZodIssue[]): ValidationErrorDetail[] => {
  const seen = new Map<string, ValidationErrorDetail>();

  for (const issue of issues) {
    const field = issue.path.length > 0 ? issue.path.join('.') : 'body';
    if (!seen.has(field)) {
      seen.set(field, { field, message: issue.message });
    }
  }

  return Array.from(seen.values());
};

export const respondWithValidationError = (res: Response, issues: ZodIssue[]): void => {
  res.locals.errorCode = 'VALIDATION_ERROR';
  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Corpo da requisição inválido.',
      details: { errors: formatZodIssues(issues) },
    },
  });
};

export const buildValidationError = (issues: ZodIssue[]): HandledError =>
  new HandledError({
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Corpo da requisição inválido.',
    details: { errors: formatZodIssues(issues) },
  });
