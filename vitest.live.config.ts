import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Live agent evaluation (real LLM + real tenant catalog/knowledge, read-mostly).
 * Kept out of the default `vitest run` include so CI never spends tokens:
 *   EVAL_LABEL=before npx vitest run -c vitest.live.config.ts
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests-live/**/*.live.ts'],
    globals: true,
    testTimeout: 20 * 60_000,
    hookTimeout: 5 * 60_000,
    setupFiles: ['dotenv/config'],
  },
})
