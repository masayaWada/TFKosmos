import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.{ts,js}',
        '**/vite-env.d.ts',
        'dist/',
        'build/',
        'e2e/',
        'playwright-report/',
        'test-results/',
        // テストファイル自体を除外
        '**/*.{test,spec}.{ts,tsx}',
        // モックファイルを除外
        '**/__mocks__/**',
        // テストセットアップファイルを除外
        'src/test/setup.ts',
      ],
      // カバレッジ閾値（オプション）
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
      },
      // カバレッジ対象を明示的に指定
      include: [
        'src/**/*.{ts,tsx}',
      ],
      // すべてのファイルを対象にする
      all: true,
    },
  },
});
