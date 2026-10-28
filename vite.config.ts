import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// DatoCMS loads the plugin from inside the npm package, so asset paths must be relative.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
})
