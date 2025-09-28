import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/tickets/index.ts',
    'src/leads/index.ts',
    'src/contacts/index.ts',
    'src/campaigns/index.ts',
    'src/analytics/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  external: ['zod', 'lodash', 'date-fns'],
  tsconfig: 'tsconfig.build.json',
});
