/**
 * Vercel Serverless Proxy for IRCTC API
 * Routes:
 *   /proxy/charts/**     → https://www.irctc.co.in/online-charts/**
 *   /proxy/eticketing/** → https://www.irctc.co.in/eticketing/**
 *
 * This function adds all mandatory IRCTC headers (bmirak, greq, Origin, Referer)
 * and forwards cookies from the client browser to support authenticated endpoints.
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { target } = req.query;
  // path* wildcard comes as array or string — join it
  const pathParts = req.query.path;
  const path = Array.isArray(pathParts) ? pathParts.join('/') : (pathParts || '');

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

  // Mandatory IRCTC request headers
  const forwardHeaders = {
    'accept':          'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'bmirak':          'webbm',
    'greq':            Date.now().toString(),
    'origin':          'https://www.irctc.co.in',
    'referer':         'https://www.irctc.co.in/online-charts/',
    'user-agent':      req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  if (req.method === 'POST') {
    forwardHeaders['content-type'] = 'application/json';
  }

  // Forward the client's cookies (needed for authenticated IRCTC endpoints)
  if (req.headers.cookie) {
    forwardHeaders['cookie'] = req.headers.cookie;
  }

  let body;
  if (req.method === 'POST' && req.body) {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(targetUrl, {
      method:  req.method,
      headers: forwardHeaders,
      body,
    });

    const text        = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';

    // Forward Set-Cookie so the browser stores IRCTC session cookies
    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) res.setHeader('Set-Cookie', setCookie);

    res.setHeader('Content-Type', contentType);
    res.status(upstream.status).send(text);
  } catch (err) {
    console.error('[proxy] error:', err.message);
    res.status(502).json({ error: `Proxy failed: ${err.message}` });
  }
}
