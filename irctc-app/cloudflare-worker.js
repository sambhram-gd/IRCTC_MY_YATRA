/**
 * Cloudflare Worker — IRCTC API Proxy (Robust Version)
 *
 * This worker solves Cloudflare 520 errors by:
 *   1. Buffering the request body to avoid streaming lockups.
 *   2. Only copying safe response headers (avoiding Content-Encoding/Content-Length mismatch).
 *   3. Buffering the response via arrayBuffer.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin':  '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    if (url.pathname === '/test') {
      try {
        const res = await fetch('https://httpbin.org/headers');
        const json = await res.json();
        return new Response(JSON.stringify({ success: true, json }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    if (url.pathname === '/test-irctc') {
      try {
        const res = await fetch('https://www.irctc.co.in/online-charts/');
        const text = await res.text();
        return new Response(JSON.stringify({ success: true, status: res.status, preview: text.slice(0, 500) }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message, stack: e.stack }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    let targetPath;
    if (url.pathname.startsWith('/proxy/charts/')) {
      targetPath = '/online-charts/' + url.pathname.slice('/proxy/charts/'.length);
    } else if (url.pathname.startsWith('/proxy/eticketing/')) {
      targetPath = '/eticketing/' + url.pathname.slice('/proxy/eticketing/'.length);
    } else {
      return new Response(JSON.stringify({ error: 'Unknown proxy path' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
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
      // (Cloudflare handles content-encoding/compression automatically)
      const responseHeaders = new Headers();
      responseHeaders.set('Access-Control-Allow-Origin',  '*');
      responseHeaders.set('Access-Control-Allow-Headers', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

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
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  },
};
