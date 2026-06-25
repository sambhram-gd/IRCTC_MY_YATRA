// CommonJS syntax required for Vercel serverless functions
const axios = require('axios');

/**
 * Debug endpoint — visit /api/debug?trainNo=12080 to see what IRCTC returns.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const trainNo = req.query.trainNo || '12080';
  const IRCTC   = 'https://www.irctc.co.in';

  const headers = {
    'accept':          'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'bmirak':          'webbm',
    'greq':            Date.now().toString(),
    'origin':          IRCTC,
    'referer':         `${IRCTC}/online-charts/`,
    'user-agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'content-type':    'application/json',
  };
  if (req.headers.cookie) headers['cookie'] = req.headers.cookie;

  const results = {};

  const tryRequest = async (label, method, url, data) => {
    try {
      const r = await axios({
        method, url, headers,
        data: data ? JSON.stringify(data) : undefined,
        responseType: 'text',
        timeout: 6000,
        validateStatus: () => true,
      });
      results[label] = { status: r.status, body: (r.data || '').slice(0, 800) };
    } catch (e) {
      results[label] = { error: e.message };
    }
  };

  await tryRequest('1_composition_empty',       'post', `${IRCTC}/online-charts/api/trainComposition`,    { trainNo, jDate: new Date().toISOString().split('T')[0], boardingStation: '' });
  await tryRequest('2_charts_schedule_post',    'post', `${IRCTC}/online-charts/api/trainSchedule`,       { trainNo });
  await tryRequest('3_charts_schedule_get',     'get',  `${IRCTC}/online-charts/api/trainSchedule?trainNo=${trainNo}`);
  await tryRequest('4_eticketing_public',       'get',  `${IRCTC}/eticketing/mapps1/trnscheduleenquiry/${trainNo}`);
  await tryRequest('5_eticketing_protected',    'get',  `${IRCTC}/eticketing/protected/mapps1/trnscheduleenquiry/${trainNo}`);

  res.status(200).json({ trainNo, results });
};
