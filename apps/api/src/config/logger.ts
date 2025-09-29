import fs from 'fs';
import path from 'path';
import winston from 'winston';

const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const resolveLogFilePath = (envPath: string | undefined, fallbackFileName: string) => {
  if (envPath && envPath.trim().length > 0) {
    return path.resolve(process.cwd(), envPath);
  }

  return path.join(logsDir, fallbackFileName);
};

const ensureDirectoryForFile = (filePath: string) => {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

const combinedLogPath = resolveLogFilePath(process.env.LOG_FILE, 'combined.log');
const errorLogPath = resolveLogFilePath(process.env.LOG_FILE_ERROR, 'error.log');

ensureDirectoryForFile(combinedLogPath);
ensureDirectoryForFile(errorLogPath);

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
    // Arquivo para logs de erro
    new winston.transports.File({
      filename: errorLogPath,
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Arquivo com todos os logs
    new winston.transports.File({
      filename: combinedLogPath,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Em desenvolvimento, também log no console com cores
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(
        colorize(),
        simple()
      ),
    })
  );
}

// Stream para o Morgan (request logger)
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
