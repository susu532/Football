import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
          'vendor-physics': ['cannon-es'],
          'vendor-react': ['react', 'react-dom', 'zustand'],
        }
      }
    }
  }
})
