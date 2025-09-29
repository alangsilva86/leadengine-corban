import path from 'node:path';
import { defineConfig } from 'vitest/config';

const resolvePackageRoot = (pkg: string) => path.resolve(__dirname, `../../packages/${pkg}/src`);

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: [
      { find: '@ticketz/core', replacement: path.join(resolvePackageRoot('core'), 'index.ts') },
      { find: '@ticketz/core/', replacement: `${resolvePackageRoot('core')}/` },
      { find: '@ticketz/shared', replacement: path.join(resolvePackageRoot('shared'), 'index.ts') },
      { find: '@ticketz/shared/', replacement: `${resolvePackageRoot('shared')}/` },
      { find: '@ticketz/storage', replacement: path.join(resolvePackageRoot('storage'), 'index.ts') },
      { find: '@ticketz/storage/', replacement: `${resolvePackageRoot('storage')}/` },
      { find: '@ticketz/integrations', replacement: path.join(resolvePackageRoot('integrations'), 'index.ts') },
      { find: '@ticketz/integrations/', replacement: `${resolvePackageRoot('integrations')}/` },
    ],
  },
});
