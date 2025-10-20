#!/usr/bin/env node

import { spawn } from 'node:child_process';

const MAX_ATTEMPTS = Math.max(1, Number(process.env.PRISMA_MIGRATE_MAX_ATTEMPTS ?? 5));
const RETRY_DELAY_MS = Math.max(1000, Number(process.env.PRISMA_MIGRATE_RETRY_DELAY_MS ?? 5000));

const DATABASE_URL = process.env.DATABASE_URL?.trim();

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required to run migrations.');
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_URL,
  PRISMA_MIGRATE_ENGINE_MAX_DATABASE_CONNECTIONS:
    process.env.PRISMA_MIGRATE_ENGINE_MAX_DATABASE_CONNECTIONS ??
    process.env.PRISMA_MIGRATE_MAX_DATABASE_CONNECTIONS ??
    '1',
};

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = [
  '--filter',
  '@ticketz/storage',
  'exec',
  'prisma',
  'migrate',
  'deploy',
  '--schema=packages/storage/prisma/schema.prisma',
];

const shouldRetry = (stderr, stdout) => {
  const combined = `${stdout}\n${stderr}`.toLowerCase();
  return (
    combined.includes('remaining connection slots are reserved for roles with the superuser attribute') ||
    combined.includes('sorry, too many clients already')
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runAttempt = async (attempt) => {
  console.info(`🚀 Running prisma migrate deploy (attempt ${attempt}/${MAX_ATTEMPTS})`);

  let stdout = '';
  let stderr = '';

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['inherit', 'pipe', 'pipe'] });

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    child.on('error', (error) => {
      stderr += error.message;
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const error = new Error(`Prisma migrate deploy exited with code ${code ?? 'unknown'}.`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  }).catch(async (error) => {
    if (attempt >= MAX_ATTEMPTS) {
      throw error;
    }

    if (!shouldRetry(error.stderr ?? '', error.stdout ?? '')) {
      throw error;
    }

    const delay = RETRY_DELAY_MS * attempt;
    console.warn(
      `⚠️ Prisma migrate deploy failed due to database connection saturation. Retrying in ${delay}ms...`,
    );
    await sleep(delay);
    await runAttempt(attempt + 1);
  });
};

runAttempt(1)
  .then(() => {
    console.info('✅ Prisma migrations applied successfully.');
  })
  .catch((error) => {
    console.error('❌ Prisma migrations failed.');
    if (error?.stderr) {
      console.error(error.stderr);
    }
    process.exit(typeof error?.code === 'number' ? error.code : 1);
  });
