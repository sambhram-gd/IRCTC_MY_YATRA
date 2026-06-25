/**
 * Debug endpoint — call this from browser to see what IRCTC returns.
 * Usage: https://your-vercel-app.vercel.app/api/debug?trainNo=12080
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const trainNo = req.query.trainNo || '12080';

  const IRCTC = 'https://www.irctc.co.in';
  const headers = {
    'accept':          'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'bmirak':          'webbm',
    'greq':            Date.now().toString(),
    'origin':          IRCTC,
    'referer':         `${IRCTC}/online-charts/`,
    'user-agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  if (req.headers.cookie) headers['cookie'] = req.headers.cookie;

  const results = {};

  // Test 1: trainComposition (empty boarding)
  try {
    const r = await fetch(`${IRCTC}/online-charts/api/trainComposition`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ trainNo, jDate: new Date().toISOString().split('T')[0], boardingStation: '' }),
    });
    const text = await r.text();
    results['1_trainComposition_empty'] = { status: r.status, bodyPreview: text.slice(0, 500) };
  } catch (e) { results['1_trainComposition_empty'] = { error: e.message }; }

  // Test 2: online-charts trainSchedule POST
  try {
    const r = await fetch(`${IRCTC}/online-charts/api/trainSchedule`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ trainNo }),
    });
    const text = await r.text();
    results['2_charts_trainSchedule_post'] = { status: r.status, bodyPreview: text.slice(0, 500) };
  } catch (e) { results['2_charts_trainSchedule_post'] = { error: e.message }; }

  // Test 3: eticketing (non-protected)
  try {
    const r = await fetch(`${IRCTC}/eticketing/mapps1/trnscheduleenquiry/${trainNo}`, { headers });
    const text = await r.text();
    results['3_eticketing_public'] = { status: r.status, bodyPreview: text.slice(0, 500) };
  } catch (e) { results['3_eticketing_public'] = { error: e.message }; }

  // Test 4: eticketing protected
  try {
    const r = await fetch(`${IRCTC}/eticketing/protected/mapps1/trnscheduleenquiry/${trainNo}`, { headers });
    const text = await r.text();
    results['4_eticketing_protected'] = { status: r.status, bodyPreview: text.slice(0, 500) };
  } catch (e) { results['4_eticketing_protected'] = { error: e.message }; }

  res.status(200).json({ trainNo, results });
}
