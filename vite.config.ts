import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'https';

// Vite plugin to fetch Google Sheet tabs without CORS issues
function googleSheetsPlugin() {
  return {
    name: 'google-sheets-proxy',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/api/sheet')) {
          const urlObj = new URL(req.url, 'http://localhost');
          const gid = urlObj.searchParams.get('gid') || '1558868693';
          const targetUrl = `https://docs.google.com/spreadsheets/d/15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY/export?format=csv&gid=${gid}`;
          
          try {
            https.get(targetUrl, (proxyRes) => {
              // Handle redirects if any
              if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
                https.get(proxyRes.headers.location, (redirectRes) => {
                  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  redirectRes.pipe(res);
                }).on('error', (err) => {
                  res.statusCode = 500;
                  res.end(err.message);
                });
                return;
              }

              res.setHeader('Content-Type', 'text/csv; charset=utf-8');
              res.setHeader('Access-Control-Allow-Origin', '*');
              proxyRes.pipe(res);
            }).on('error', (err) => {
              res.statusCode = 500;
              res.end(err.message);
            });
          } catch (e: any) {
            res.statusCode = 500;
            res.end(e.toString());
          }
        } else {
          next();
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), googleSheetsPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
