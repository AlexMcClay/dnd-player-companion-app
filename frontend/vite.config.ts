import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Point at the workspace source directly so there is no build step for shared types.
      '@codex/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // The editor roughly doubles the app's JavaScript and is only needed
        // when someone writes something. Naming the chunk explicitly stops a
        // shared import dragging ProseMirror back into the entry bundle.
        /*
          Every dependency is assigned explicitly, rather than only the editor's.
          A library shared between the eager app and the editor — React, because
          @tiptap/react imports it, and marked, because the renderer and
          @tiptap/markdown both do — gets folded into whichever manual chunk
          claims it. That makes the entry import the editor chunk, and the split
          silently stops existing.
        */
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          return /node_modules[\\/](@tiptap|prosemirror-|orderedmap|rope-sequence|w3c-keyname|linkifyjs)/.test(
            id,
          )
            ? 'editor'
            : 'vendor'
        },
      },
    },
  },
  server: {
    port: 5173,
    // Lets phones on the same wifi reach the dev server.
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
