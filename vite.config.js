import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
import fs from 'fs';

const systemPrompt = fs.readFileSync('llm_prompt.md', 'utf-8');

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: 'llm_prompt.md',
          dest: '.'
        }
      ]
    })
  ],
  define: {
    __SYSTEM_PROMPT__: JSON.stringify(systemPrompt),
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
  base: './', // Ensure assets are loaded correctly on GitHub Pages
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  server: {
    port: 8081,
  }
});