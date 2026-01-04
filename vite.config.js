import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-three': ['three'],
          'vendor-r3f': ['@react-three/fiber', '@react-three/drei'],
          'vendor-rapier': ['@dimforge/rapier3d-compat'],
          'vendor-physics-core': ['@react-three/rapier', 'cannon-es'],
          'vendor-react-core': ['react', 'react-dom', 'zustand'],
        }
      }
    }
  }
})
