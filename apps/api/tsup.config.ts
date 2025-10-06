import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['cjs'],
  bundle: false,
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'node20',
  external: [
    '@ticketz/core',
    '@ticketz/shared',
    '@ticketz/storage',
    '@ticketz/integrations',
    '@prisma/client',
    'prisma',
  ],
  skipNodeModulesBundle: true,
});
