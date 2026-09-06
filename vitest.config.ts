import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // Next preserves JSX for its own compiler; component rendering tests need
  // Vite to transform it before loading TSX modules in Node.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" -> "./*" path mapping.
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
})
