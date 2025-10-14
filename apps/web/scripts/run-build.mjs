import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const isCI = Boolean(process.env.CI);
const cliArgs = ['build'];

// Allow maintainers to pass through additional Vite CLI options, e.g.
// `pnpm -F web run build -- --analyze`
cliArgs.push(...process.argv.slice(2));

if (isCI) {
  cliArgs.push('--config', 'vite.build.ci.mjs');
}

const thisDir = dirname(fileURLToPath(import.meta.url));
const vitePath = resolve(thisDir, '../node_modules/vite/bin/vite.js');

const child = spawn(process.execPath, [vitePath, ...cliArgs], {
  stdio: 'inherit',
  env: process.env,
});

child.on('close', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
