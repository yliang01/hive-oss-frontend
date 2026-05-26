import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: '../target/generated-resources/static',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-element': ['element-plus', '@element-plus/icons-vue'],
          'vendor-axios': ['axios'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/categories': 'http://localhost:8080',
      '/db-backup': 'http://localhost:8080',
      '/category-admin': 'http://localhost:8080',
    },
  },
});
