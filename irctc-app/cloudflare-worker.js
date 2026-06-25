/**
 * Cloudflare Worker — IRCTC API Proxy (Robust & CORS-Compliant Version)
 *
 * This worker solves:
 *   1. Cloudflare 520 errors by copying only safe response headers and buffering responses.
 *   2. CORS errors by echoing the requesting origin and allowing credentials (withCredentials).
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin':  origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
      });
    }

    let targetPath;
    if (url.pathname.startsWith('/proxy/charts/')) {
      targetPath = '/online-charts/' + url.pathname.slice('/proxy/charts/'.length);
    } else if (url.pathname.startsWith('/proxy/eticketing/')) {
      targetPath = '/eticketing/' + url.pathname.slice('/proxy/eticketing/'.length);
    } else {
      return new Response(JSON.stringify({ error: 'Unknown proxy path' }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true'
        },
      });
    }

    const targetUrl = `https://www.irctc.co.in${targetPath}${url.search}`;

    // Spoof browser headers
    const headers = new Headers();
    headers.set('accept',          'application/json, text/plain, */*');
    headers.set('accept-language', 'en-US,en;q=0.9');
    headers.set('bmirak',          'webbm');
    headers.set('greq',            Date.now().toString());
    headers.set('origin',          'https://www.irctc.co.in');
    headers.set('referer',         'https://www.irctc.co.in/online-charts/');
    headers.set('user-agent',      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    headers.set('sec-ch-ua',       '"Google Chrome";v="125", "Chromium";v="125"');
    headers.set('sec-fetch-dest',  'empty');
    headers.set('sec-fetch-mode',  'cors');
    headers.set('sec-fetch-site',  'same-origin');

    // Forward cookies
    const cookie = request.headers.get('cookie');
    if (cookie) headers.set('cookie', cookie);

    let body = undefined;
    if (request.method === 'POST') {
      headers.set('content-type', 'application/json');
      body = await request.text();
    }

    try {
      const upstream = await fetch(targetUrl, {
        method:  request.method,
        headers,
        body,
      });

      // Only copy safe response headers to prevent Cloudflare 520 errors
      const responseHeaders = new Headers();
      responseHeaders.set('Access-Control-Allow-Origin',  origin);
      responseHeaders.set('Access-Control-Allow-Headers', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Credentials', 'true');

      const contentType = upstream.headers.get('content-type');
      if (contentType) responseHeaders.set('Content-Type', contentType);

      const setCookie = upstream.headers.get('set-cookie');
      if (setCookie) responseHeaders.set('Set-Cookie', setCookie);

      // Buffer response data
      const data = await upstream.arrayBuffer();

      return new Response(data, {
        status:  upstream.status,
        headers: responseHeaders,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true'
        }
      });
    }
  },
};
