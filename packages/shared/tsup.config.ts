import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  format: ['cjs', 'esm'],
  target: 'es2022',
  tsconfig: './tsconfig.build.json',
});
