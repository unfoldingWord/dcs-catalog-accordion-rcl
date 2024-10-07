import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs-extra';
import https from 'https';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      plugins: [
        {
          name: 'fetch-langnames',
          buildStart: async () => {
            const url = 'https://git.door43.org/api/v1/languages/langnames.json';
            const filePath = 'src/data/langnames.json';

            await new Promise((resolve, reject) => {
              const file = fs.createWriteStream(filePath);
              https.get(url, (response) => {
                response.pipe(file);
                file.on('finish', () => {
                  file.close();
                  console.log('Downloaded langnames.json');
                  resolve();
                });
                file.on('error', (err) => {
                  fs.unlink(filePath);
                  reject(err);
                });
              }).on('error', (err) => {
                fs.unlink(filePath);
                reject(err);
              });
            });
          },
        },
      ],
    },
  },
});