import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const resolvePackageRoot = (pkg: string) => path.resolve(currentDir, `../../packages/${pkg}/src`);

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [path.resolve(currentDir, './test/bootstrap.ts')],
  },
  resolve: {
    alias: [
      { find: '@ticketz/core', replacement: path.join(resolvePackageRoot('core'), 'index.ts') },
      { find: '@ticketz/core/', replacement: `${resolvePackageRoot('core')}/` },
      { find: '@ticketz/shared', replacement: path.join(resolvePackageRoot('shared'), 'index.ts') },
      { find: '@ticketz/shared/', replacement: `${resolvePackageRoot('shared')}/` },
      { find: '@ticketz/contracts', replacement: path.join(resolvePackageRoot('contracts'), 'index.ts') },
      { find: '@ticketz/contracts/', replacement: `${resolvePackageRoot('contracts')}/` },
      { find: '@ticketz/storage', replacement: path.join(resolvePackageRoot('storage'), 'index.ts') },
      { find: '@ticketz/storage/', replacement: `${resolvePackageRoot('storage')}/` },
      { find: '@ticketz/integrations', replacement: path.join(resolvePackageRoot('integrations'), 'index.ts') },
      { find: '@ticketz/integrations/', replacement: `${resolvePackageRoot('integrations')}/` },
      { find: '@ticketz/wa-contracts', replacement: path.join(resolvePackageRoot('wa-contracts'), 'index.ts') },
      { find: '@ticketz/wa-contracts/', replacement: `${resolvePackageRoot('wa-contracts')}/` },
    ],
  },
});
