import https from 'https';

export default function handler(req, res) {
  const targetUrl = 'https://yerbazo-default-rtdb.firebaseio.com/store.json';
  https.get(targetUrl, (proxyRes) => {
    let raw = '';
    proxyRes.on('data', chunk => { raw += chunk; });
    proxyRes.on('end', () => {
      try {
        const data = JSON.parse(raw);
        if (!data.coupons) {
          data.coupons = [];
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json(data);
      } catch (e) {
        res.status(500).json({ error: 'Failed parsing store data' });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
}
