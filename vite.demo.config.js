import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Builds the dev sandbox (src/App.jsx, the page `pnpm dev` serves) as a standalone
// site for Netlify: the demo-mode switcher at /, plus the static-embed example at
// /embed.html with the freshly built UMD bundle it references. The library build must
// run first to produce that bundle — netlify.toml chains `pnpm build && pnpm build:demo`.
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: './index-build.html', dest: '', rename: 'embed.html' },
        { src: './dist/dcs-map-and-accordion.umd.js', dest: '' },
      ],
    }),
  ],
  build: {
    outDir: 'dist-demo',
  },
});
