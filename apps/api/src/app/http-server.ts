import cors, { type CorsOptions } from 'cors';
import express, { type Application } from 'express';
import { createServer, type Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const normalizeOrigin = (origin: string): string => {
  const trimmed = origin.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed === '*') {
    return '*';
  }

  return trimmed.toLowerCase().replace(/\/+$/, '');
};

const defaultCorsOrigins = ['https://leadengine-corban.up.railway.app'].map(normalizeOrigin);
const configuredCorsOrigins = (process.env.FRONTEND_URL ?? '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);
const parsedCorsOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const corsAllowedOrigins = new Set<string>([...defaultCorsOrigins, ...configuredCorsOrigins, ...parsedCorsOrigins]);
const allowAllOrigins = corsAllowedOrigins.has('*');

if (allowAllOrigins) {
  corsAllowedOrigins.delete('*');
}

const resolvedCorsOrigins = Array.from(corsAllowedOrigins);

const sharedCorsSettings = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as string[],
  allowedHeaders: [
    'content-type',
    'authorization',
    'x-tenant-id',
    'accept',
    'x-api-key',
    'x-platform-admin-token',
    'x-platform-admin',
    'idempotency-key',
  ] as string[],
};

const corsOptions: CorsOptions = allowAllOrigins
  ? {
      origin: true,
      ...sharedCorsSettings,
    }
  : {
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }

        const normalizedOrigin = normalizeOrigin(origin);

        if (corsAllowedOrigins.has(normalizedOrigin)) {
          return callback(null, true);
        }

        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      ...sharedCorsSettings,
    };

const socketPath = process.env.SOCKET_IO_PATH ?? '/socket.io';

const socketCorsConfig = allowAllOrigins
  ? {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    }
  : {
      origin: resolvedCorsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    };

type CreateHttpServerResult = {
  app: Application;
  server: HttpServer;
  io: SocketIOServer;
  corsOptions: CorsOptions;
};

export const createHttpServer = (): CreateHttpServerResult => {
  const app = express();
  const server = createServer(app);

  const io = new SocketIOServer(server, {
    path: socketPath,
    cors: socketCorsConfig,
    pingTimeout: 25_000,
    pingInterval: 20_000,
  });

  return { app, server, io, corsOptions };
};
