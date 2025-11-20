import { mapPrismaError, type PrismaErrorMappingOptions } from './prisma-error';

export interface HttpErrorPayload {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export interface ServiceErrorMapping {
  match: (error: unknown) => boolean;
  map: (error: unknown) => HttpErrorPayload;
}

export interface HttpErrorTranslatorOptions {
  services?: ServiceErrorMapping[];
  prisma?: PrismaErrorMappingOptions;
}

export interface HttpErrorTranslateOptions extends HttpErrorTranslatorOptions {
  requestId?: string | null;
  includeRequestId?: boolean;
}

export interface HttpTranslatedError {
  status: number;
  payload: {
    success: false;
    error: {
      code: string;
      message: string;
      details?: unknown;
      requestId?: string | null;
    };
    requestId?: string | null;
  };
}

export class HttpErrorTranslator {
  constructor(private readonly options: HttpErrorTranslatorOptions = {}) {}

  translate(error: unknown, options: HttpErrorTranslateOptions = {}): HttpTranslatedError | null {
    const services = [...(this.options.services ?? []), ...(options.services ?? [])];

    for (const mapping of services) {
      if (mapping.match(error)) {
        return this.buildPayload(mapping.map(error), options);
      }
    }

    const prismaOptions = options.prisma ?? this.options.prisma;
    if (prismaOptions) {
      const prismaError = mapPrismaError(error, prismaOptions);

      if (prismaError) {
        return this.buildPayload(prismaError, options);
      }
    }

    return null;
  }

  private buildPayload(error: HttpErrorPayload, options: HttpErrorTranslateOptions): HttpTranslatedError {
    const requestId = options.includeRequestId ? options.requestId ?? null : null;
    const errorPayload: HttpTranslatedError['payload']['error'] = {
      code: error.code,
      message: error.message,
    };

    if (error.details !== undefined) {
      errorPayload.details = error.details;
    }

    if (requestId) {
      errorPayload.requestId = requestId;
    }

    const payload: HttpTranslatedError['payload'] = {
      success: false,
      error: errorPayload,
    };

    if (requestId) {
      payload.requestId = requestId;
    }

    return {
      status: error.status,
      payload,
    } satisfies HttpTranslatedError;
  }
}

