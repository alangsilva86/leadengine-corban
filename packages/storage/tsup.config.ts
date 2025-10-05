import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  target: 'es2022',
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  format: ['cjs', 'esm'],
  target: 'es2022',
  external: ['@ticketz/core'],
  tsconfig: './tsconfig.build.json',
});
