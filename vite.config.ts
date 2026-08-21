import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' makes the build work under any GitHub Pages sub-path.
export default defineConfig({
  plugins: [react()],
  base: './',
})
