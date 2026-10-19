import https from 'https';

export default function handler(req, res) {
  const gid = req.query.gid || '1558868693';
  const targetUrl = `https://docs.google.com/spreadsheets/d/15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY/export?format=csv&gid=${gid}&t=${Date.now()}`;

  const fetchWithRedirect = (url) => {
    https.get(url, { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' } }, (proxyRes) => {
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        fetchWithRedirect(proxyRes.headers.location);
        return;
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Access-Control-Allow-Origin', '*');
      proxyRes.pipe(res);
    }).on('error', (err) => {
      res.status(500).send(err.message);
    });
  };

  fetchWithRedirect(targetUrl);
}
