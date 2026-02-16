import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
import fs from 'fs';

const systemPrompts = {
  advancedRoa: fs.readFileSync('prompts/advanced-roa-analysis.md', 'utf-8'),
  basicFinancials: fs.readFileSync('prompts/basic-financials.md', 'utf-8'),
  quizBasicFinancials: fs.readFileSync('prompts/quiz-basic-financials.md', 'utf-8'),
  quizRoaAnalysis: fs.readFileSync('prompts/quiz-roa-analysis.md', 'utf-8'),
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: 'prompts/*.md',
          dest: 'prompts'
        }
      ]
    })
  ],
  define: {
    __SYSTEM_PROMPTS__: JSON.stringify(systemPrompts),
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