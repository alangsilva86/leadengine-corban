import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['cjs'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'node18',
  external: [
    '@ticketz/core',
    '@ticketz/shared',
    '@ticketz/storage',
    '@ticketz/integrations',
  ],
});
