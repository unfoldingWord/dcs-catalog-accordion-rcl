import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: './index-build.html',
          dest: '',
          rename: 'index.html'
        },
        {
          src: './index-obs.html',
          dest: '',
          rename: 'obs.html'
        }
      ]
    })
  ],
  build: {
    lib: {
      entry: './src/index.js',
      name: 'DcsMapAndAccordion',
      fileName: (format) => `dcs-map-and-accordion.${format}.js`,
      formats: ['umd', 'es'],
    },
    rollupOptions: {
      // Ensure to externalize deps that shouldn't be bundled
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    minify: false, // Disable minification
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});