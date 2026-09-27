import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// 開發時 /api 轉給 wrangler dev(8788);正式環境用 VITE_API_BASE 指向 Worker 網址。
export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8788', rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
})
