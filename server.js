import express from 'express';
import cors from 'cors';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Google Sheets proxy route (always fresh, no cache)
app.get('/api/sheet', (req, res) => {
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
      proxyRes.pipe(res);
    }).on('error', (err) => {
      res.status(500).send(err.message);
    });
  };

  fetchWithRedirect(targetUrl);
});

// Yerbazo web store live proxy route
app.get('/api/web-store', (req, res) => {
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
        res.json(data);
      } catch (e) {
        res.status(500).json({ error: 'Failed parsing store data' });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

// Google Sheets write proxy route (forwards POST to Google Apps Script following redirects)
app.post('/api/sheet-write', async (req, res) => {
  const { scriptUrl, payload } = req.body || {};
  if (!scriptUrl || typeof scriptUrl !== 'string' || !scriptUrl.startsWith('https://script.google.com/')) {
    return res.status(400).json({ ok: false, error: 'URL de Google Apps Script inválida o no configurada' });
  }

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload || {}),
      redirect: 'follow'
    });
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return res.json(json);
    } catch {
      return res.json({ ok: response.ok, message: 'Enviado a Google Sheets', raw: text.slice(0, 200) });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Serve frontend dist if built
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌿 Yerbazo Analytics Server listening on port ${PORT}`);
});
