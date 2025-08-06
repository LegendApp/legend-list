import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
  define: {
    __DEV__: JSON.stringify(true),
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['react-native'],
  },
})