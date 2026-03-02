import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  base: '/',
  build: {
    outDir: '../src/main/resources/static',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        files: 'pages/files.html',
        categoryAdmin: 'pages/category-admin.html',
      },
    },
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: {
    port: 3000,
    strictPort: false,
  },
});
