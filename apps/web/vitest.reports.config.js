import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vite.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['src/components/__tests__/Reports.test.jsx'],
      environment: 'jsdom',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/components/Reports.jsx'],
      },
    },
  })
);
