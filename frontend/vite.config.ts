/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// frontend/.env (see .env.example); real environment variables win over the file.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const API_TARGET = env.VITE_API_TARGET || 'http://127.0.0.1:8800'
  const WEB_PORT = Number(env.WEB_PORT || 5180)
  return {
    plugins: [react()],
    server: {
      port: WEB_PORT,
      strictPort: true,
      proxy: {
        '/api': { target: API_TARGET, changeOrigin: true },
        '/ws': { target: API_TARGET, ws: true, changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
            charts: ['recharts'],
            markdown: ['react-markdown', 'remark-gfm'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
