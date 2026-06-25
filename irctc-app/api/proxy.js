// CommonJS syntax required for Vercel serverless functions
const axios = require('axios');

/**
 * Vercel Serverless Proxy for IRCTC API
 * /proxy/charts/**     → https://www.irctc.co.in/online-charts/**
 * /proxy/eticketing/** → https://www.irctc.co.in/eticketing/**
 */
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { target } = req.query;
  const pathParts  = req.query.path;
  const path       = Array.isArray(pathParts) ? pathParts.join('/') : (pathParts || '');

  const baseMap = {
    charts:     'https://www.irctc.co.in/online-charts',
    eticketing: 'https://www.irctc.co.in/eticketing',
  };

  const base = baseMap[target];
  if (!base) {
    res.status(400).json({ error: `Unknown proxy target: ${target}` });
    return;
  }

  const targetUrl = `${base}/${path}`;
  console.log(`[proxy] ${req.method} ${targetUrl}`);

  const reqHeaders = {
    'accept':          'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'bmirak':          'webbm',
    'greq':            Date.now().toString(),
    'origin':          'https://www.irctc.co.in',
    'referer':         'https://www.irctc.co.in/online-charts/',
    'user-agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  };

  if (req.method === 'POST') {
    reqHeaders['content-type'] = 'application/json';
  }

  // Forward the client's IRCTC session cookies (enables protected endpoints)
  if (req.headers.cookie) {
    reqHeaders['cookie'] = req.headers.cookie;
  }

  try {
    const upstream = await axios({
      method:       req.method.toLowerCase(),
      url:          targetUrl,
      headers:      reqHeaders,
      data:         req.method === 'POST' ? req.body : undefined,
      responseType: 'text',
      timeout:      8000,
      // Don't throw on non-2xx — forward status as-is
      validateStatus: () => true,
    });

    // Forward Set-Cookie so browser keeps IRCTC session alive
    const setCookie = upstream.headers['set-cookie'];
    if (setCookie) res.setHeader('Set-Cookie', setCookie);

    const contentType = upstream.headers['content-type'] || 'application/json';
    res.setHeader('Content-Type', contentType);
    res.status(upstream.status).send(upstream.data);
  } catch (err) {
    console.error('[proxy] error:', err.message);
    res.status(502).json({ error: `Upstream proxy failed: ${err.message}` });
  }
};
