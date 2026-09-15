import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      /*
        A hand-written service worker rather than a generated one. The rule that
        matters most here — that a cached API response belongs to the identity
        that asked for it — is real logic, not configuration, and `generateSW`
        has nowhere to put it. What the plugin is here for is the precache
        manifest: the file names carry Vite's content hashes and cannot be
        maintained by hand.
      */
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Never silently. The app is open in front of the table mid-session, and
      // a reload that happens on its own loses whatever is half-typed.
      registerType: 'prompt',
      // Registered from React instead, so one piece of code owns both the
      // registration and the "a new version is ready" prompt. Left on default,
      // the plugin injects its own script and the worker is registered twice.
      injectRegister: null,
      injectManifest: {
        // The editor chunk alone is ~420 kB, and the default cap is 2 MB.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Default for this strategy is scripts and styles only, which would
        // leave the icons to be fetched from a network that may not be there.
        globPatterns: ['**/*.{js,css,html,png,ico,svg,webmanifest}'],
      },
      // The service worker would otherwise cache during development and serve
      // yesterday's bundle back while you are editing it.
      devOptions: { enabled: false },
      manifest: {
        name: 'Party Codex',
        short_name: 'Codex',
        description: 'A player-facing D&D companion — only what the party has learned.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Not locked to portrait: the desktop side rail exists, and a laptop
        // held the only way it can be held should not be fighting the manifest.
        orientation: 'any',
        theme_color: '#141414',
        // The page itself is a radial gradient a splash screen cannot express;
        // this is the colour at its outer edge, so the seam does not show.
        background_color: '#141414',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
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
  // `preview` does not inherit `server`, and it is where the service worker is
  // actually testable — dev has it switched off, and localhost is the only
  // secure context available without deploying.
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
