export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

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
      return res.status(200).json(json);
    } catch {
      return res.status(200).json({ ok: response.ok, message: 'Enviado a Google Sheets', raw: text.slice(0, 200) });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
