import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      'react-native': path.resolve(__dirname, '../src/platform/react-native-web-shim.ts'),
    },
    // Use .tsx first so web platform files are preferred over .native.tsx
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
  define: {
    __DEV__: JSON.stringify(true),
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['react-native'],
  },
})