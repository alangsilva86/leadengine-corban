import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'leads/index': 'src/leads/index.ts',
    'tickets/index': 'src/tickets/index.ts',
  },
  format: ['cjs', 'esm'],
  target: 'es2022',
  dts: false,
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: true,
  external: ['zod', 'lodash', 'date-fns'],
  tsconfig: './tsconfig.build.json',
});
