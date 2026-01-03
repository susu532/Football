import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@dimforge/rapier3d-compat')) return 'vendor-rapier-wasm'
            if (id.includes('@react-three/rapier')) return 'vendor-r3-rapier'
            if (id.includes('three')) return 'vendor-three'
            if (id.includes('@react-three/drei')) return 'vendor-drei'
            if (id.includes('@react-three/fiber')) return 'vendor-fiber'
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react'
            return 'vendor-others'
          }
        }
      }
    }
  }
})
