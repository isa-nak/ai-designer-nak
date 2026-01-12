import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { resolve } from 'path'

// Plugin to remove type="module" from script tags (required for Figma)
function figmaPlugin(): Plugin {
  return {
    name: 'figma-plugin',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.html')) {
          file.source = (file.source as string)
            .replace(/<script type="module" crossorigin>/g, '<script>')
            .replace(/<script type="module">/g, '<script>')
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), figmaPlugin()],
  root: 'src/ui',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/ui/ui.html'),
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
    cssCodeSplit: false,
    assetsInlineLimit: 100000,
    minify: 'esbuild',
    target: 'es2015',
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
})
