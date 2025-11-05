import { promises as fs } from 'node:fs';
import path from 'node:path';

import { logger } from '../config/logger';

const DEFAULT_STORE_PATH = path.resolve(process.cwd(), 'apps/api/src/data/poll-metadata.json');

const ensureDirectory = async (targetPath: string): Promise<void> => {
  const directory = path.dirname(targetPath);
  await fs.mkdir(directory, { recursive: true });
};

export const resolvePollMetadataStorePath = (): string => {
  const override = process.env.POLL_METADATA_STORE_PATH;
  if (override && override.trim().length > 0) {
    return path.resolve(process.cwd(), override.trim());
  }
  return DEFAULT_STORE_PATH;
};

export const readPollMetadataStore = async (): Promise<Record<string, unknown>> => {
  const filePath = resolvePollMetadataStorePath();

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return {};
    }

    logger.warn('Poll runtime store read failed', {
      path: filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
};

export const writePollMetadataStore = async (payload: Record<string, unknown>): Promise<void> => {
  const filePath = resolvePollMetadataStorePath();

  try {
    await ensureDirectory(filePath);
    const content = JSON.stringify(payload, null, 2);
    await fs.writeFile(filePath, content, 'utf8');
  } catch (error) {
    logger.warn('Poll runtime store write failed', {
      path: filePath,
      keys: Object.keys(payload ?? {}),
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

