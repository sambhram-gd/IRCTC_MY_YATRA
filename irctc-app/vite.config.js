import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const IRCTC = 'https://www.irctc.co.in';

const makeProxy = (strip, target) => ({
  target: IRCTC,
  changeOrigin: true,
  secure: true,
  rewrite: (path) => path.replace(strip, target),
  configure: (proxy) => {
    proxy.on('proxyReq', (req) => {
      req.setHeader('Origin', IRCTC);
      req.setHeader('Referer', `${IRCTC}/online-charts/`);
    });
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/proxy/charts': makeProxy(/^\/proxy\/charts/, '/online-charts'),
      '/proxy/eticketing': makeProxy(/^\/proxy\/eticketing/, '/eticketing'),
    },
  },
})
