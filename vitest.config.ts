import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'shared/*/src/**/*.ts',
        'mos/src/lib/**/*.ts',
        'sds/src/lib/**/*.ts',
      ],
      exclude: [
        '**/__tests__/**',
        '**/node_modules/**',
        '**/schema/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@arc/types': path.resolve(__dirname, 'shared/types/src'),
      '@arc/llm': path.resolve(__dirname, 'shared/llm/src'),
      '@arc/db': path.resolve(__dirname, 'shared/db/src'),
      '@arc/embeddings': path.resolve(__dirname, 'shared/embeddings/src'),
      // MOS app alias — used by mos/src imports
      '@/': path.resolve(__dirname, 'mos/src') + '/',
    },
  },
});
