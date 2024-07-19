import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: './index.js',
      name: 'DcsCatalogAccordion',
      fileName: (format) => `dcs-catalog-accordion.${format}.js`
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
        'react-dom': 'ReactDOM'
        }
      }
    }
  }
});