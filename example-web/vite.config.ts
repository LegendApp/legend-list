import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      // Ensure React Native imports are excluded from web build
      'react-native': false,
    },
  },
  define: {
    __DEV__: JSON.stringify(true),
  },
  optimizeDeps: {
    exclude: ['react-native'],
  },
})