import fs from 'fs';
import path from 'path';
import winston from 'winston';

const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, errors, json, simple, colorize } = winston.format;

// Configuração do logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: {
    service: 'ticketz-api',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Arquivo para todos os logs
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Console transport para desenvolvimento e produção
if (process.env.NODE_ENV !== 'production') {
  // Desenvolvimento: logs com cores
  logger.add(
    new winston.transports.Console({
      format: combine(
        colorize(),
        simple()
      ),
    })
  );
} else {
  // Produção: logs em JSON para Railway capturar
  logger.add(
    new winston.transports.Console({
      format: combine(
        timestamp(),
        json()
      ),
    })
  );
}

