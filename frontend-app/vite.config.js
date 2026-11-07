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
    outDir: process.env.VITE_OUT_DIR ?? '../target/generated-resources/static',
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
      '/setup': 'http://localhost:8080',
      '/api': 'http://localhost:8080',
    },
  },
});
