import { defineConfig } from 'vite';

// base relativa para que funcione en GitHub Pages (sitio de proyecto /parcella/).
export default defineConfig({
  base: './',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  build: {
    // Los vendors grandes (mathjs ~640kB) van en chunks propios y cacheables;
    // el límite del warning se sube en consecuencia.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          mathjs: ['mathjs'],
          katex: ['katex'],
        },
      },
    },
  },
});
