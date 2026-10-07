import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import type { PluginOption } from 'vite';
import { load } from 'js-yaml';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const core = resolve(__dirname, '../../packages/core/src');
const locales = resolve(__dirname, '../../src/locales');

function yaml(): PluginOption {
  return {
    name: 'mimik-yaml',
    transform(_code: string, id: string) {
      if (!id.endsWith('.yml')) return null;
      return { code: `export default ${JSON.stringify(load(readFileSync(id, 'utf8')))}`, map: null };
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), yaml()],
    resolve: { alias: { '@mimik/locales': locales } },
    build: {
      outDir: resolve(__dirname, 'out/main'),
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          'check-capture': resolve(__dirname, 'scripts/check-capture.ts'),
          'check-storage': resolve(__dirname, 'scripts/check-storage.ts'),
          'check-overlay': resolve(__dirname, 'scripts/check-overlay.ts'),
          'check-pipeline': resolve(__dirname, 'scripts/check-pipeline.ts'),
        },
        output: { entryFileNames: '[name].js', chunkFileNames: '[name].js' },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve(__dirname, 'out/preload'),
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          overlay: resolve(__dirname, 'src/preload/overlay.ts'),
        },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    publicDir: resolve(__dirname, '../../public'),
    plugins: [yaml(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@mimik/core': core,
        '@mimik/ui': resolve(__dirname, '../../packages/ui/src'),
        '@/core': core,
        '@mimik/locales': locales,
      },
    },
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          'check-storage': resolve(__dirname, 'src/renderer/check-storage.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay.html'),
          splash: resolve(__dirname, 'src/renderer/splash.html'),
          'check-pipeline': resolve(__dirname, 'src/renderer/check-pipeline.html'),
        },
      },
    },
  },
});
