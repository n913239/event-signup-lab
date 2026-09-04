import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // 併發測試靠閘門重現競態,不能被平行執行打亂
    fileParallelism: false,
  },
})
