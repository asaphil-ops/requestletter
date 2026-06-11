import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use /requestletter/ base for GitHub Pages, root for Vercel/local
const base = process.env.GITHUB_ACTIONS ? '/requestletter/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 3000 }
})
