import { defineConfig } from 'vite';

// base relativa para que funcione en GitHub Pages (sitio de proyecto /parcella/).
export default defineConfig({
  base: './',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
