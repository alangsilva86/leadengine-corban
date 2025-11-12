import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vite.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/setupTests.js'],
    },
  }),
);
