import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  bundle: true,
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'node20',
  outDir: 'dist',
  platform: 'node',
  outExtension: () => ({
    js: '.mjs',
  }),
  external: [
    '@ticketz/core',
    '@ticketz/shared',
    '@ticketz/storage',
    '@prisma/client',
    'prisma',
  ],
  skipNodeModulesBundle: true,
});
