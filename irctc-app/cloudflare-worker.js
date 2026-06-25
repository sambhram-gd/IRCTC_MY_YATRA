/**
 * Cloudflare Worker — IRCTC API Proxy
 *
 * Deploy this as a Cloudflare Worker at:
 *   https://dash.cloudflare.com → Workers & Pages → Create Worker
 *
 * This worker forwards:
 *   /proxy/charts/**     → https://www.irctc.co.in/online-charts/**
 *   /proxy/eticketing/** → https://www.irctc.co.in/eticketing/**
 *
 * Set your Vercel env var VITE_PROXY_BASE to your worker URL.
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

    // Clone and enrich request headers to spoof browser
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
    if (request.method === 'POST') headers.set('content-type', 'application/json');

    // Forward client cookies (enables protected endpoints when user is logged into IRCTC)
    const cookie = request.headers.get('cookie');
    if (cookie) headers.set('cookie', cookie);

    const upstream = await fetch(targetUrl, {
      method:  request.method,
      headers,
      body:    request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('Access-Control-Allow-Origin',  '*');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(upstream.body, {
      status:  upstream.status,
      headers: responseHeaders,
    });
  },
};
