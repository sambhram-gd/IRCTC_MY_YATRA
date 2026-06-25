import axios from 'axios';

const proxyBase = import.meta.env.VITE_PROXY_BASE || '';

/**
 * Unified request helper that routes requests to:
 * - Google Apps Script proxy in production (if VITE_PROXY_BASE is configured).
 * - Vite local dev proxy (/proxy/...) in development.
 */
const apiRequest = async (method, type, path, data = null, options = {}) => {
  const prefix = type === 'charts' ? '/online-charts/' : '/eticketing/';
  const targetUrl = `https://www.irctc.co.in${prefix}${path}`;

  let url;
  const headers = {
    'bmirak': 'webbm',
    'greq': Date.now().toString(),
    'accept': 'application/json, text/plain, */*'
  };

  if (proxyBase) {
    // Production: Route to Google Apps Script proxy via URL parameter
    url = `${proxyBase}?url=${encodeURIComponent(targetUrl)}`;
  } else {
    // Local: Route to Vite dev server proxy
    const localPrefix = type === 'charts' ? '/proxy/charts/' : '/proxy/eticketing/';
    url = `${localPrefix}${path}`;
  }

  return axios({
    method,
    url,
    data,
    headers,
    ...options
  });
};

/**
 * Fetch full train list → ["20688 - SBC UBL SF EXP", ...]
 * GET /eticketing/trainList
 */
export const fetchTrainList = async () => {
  const res = await apiRequest('get', 'eticketing', 'trainList', null, {
    transformResponse: [(data) => {
      if (Array.isArray(data)) return data;
      if (typeof data === 'string') {
        let clean = data.trim();
        if (clean.includes('=')) clean = clean.substring(clean.indexOf('=') + 1).trim();
        if (clean.endsWith(';')) clean = clean.slice(0, -1).trim();
        try {
          return JSON.parse(clean);
        } catch {
          const match = clean.match(/\[[\s\S]*\]/);
          if (match) { try { return JSON.parse(match[0]); } catch {} }
          return [];
        }
      }
      return [];
    }],
  });
  return Array.isArray(res.data) ? res.data : [];
};

/**
 * Fetch station list for a train.
 * Tries multiple public IRCTC endpoints before falling back to protected one.
 */
export const fetchTrainSchedule = async (trainNo) => {
  const tn = trainNo.trim();

  const extract = (raw) => {
    if (!raw) return null;
    const list =
      raw?.stationList ??
      raw?.trainScheduleDTO?.stationList ??
      raw?.body?.stationList ??
      raw?.stoppage ??
      raw?.haltList ??
      raw?.stations ??
      (Array.isArray(raw) ? raw : null);
    return list && list.length > 0 ? list : null;
  };

  // Attempt 1: online-charts trainSchedule (public)
  try {
    const res = await apiRequest('post', 'charts', 'api/trainSchedule', { trainNo: tn });
    console.log('[schedule/1-charts-post] status:', res.status, 'keys:', Object.keys(res.data || {}));
    const list = extract(res.data);
    if (list) return list;
  } catch (e) { console.warn('[schedule/1]', e.message); }

  // Attempt 2: online-charts GET schedule
  try {
    const res = await apiRequest('get', 'charts', `api/trainSchedule?trainNo=${tn}`);
    console.log('[schedule/2-charts-get] status:', res.status, 'keys:', Object.keys(res.data || {}));
    const list = extract(res.data);
    if (list) return list;
  } catch (e) { console.warn('[schedule/2]', e.message); }

  // Attempt 3: non-protected eticketing GET
  try {
    const res = await apiRequest('get', 'eticketing', `mapps1/trnscheduleenquiry/${tn}`);
    console.log('[schedule/3-eticketing-public] status:', res.status);
    const list = extract(res.data);
    if (list) return list;
  } catch (e) { console.warn('[schedule/3]', e.message); }

  // Attempt 4: non-protected eticketing alternative path
  try {
    const res = await apiRequest('get', 'eticketing', `trainschedule/${tn}`);
    console.log('[schedule/4-eticketing-alt] status:', res.status);
    const list = extract(res.data);
    if (list) return list;
  } catch (e) { console.warn('[schedule/4]', e.message); }

  // Attempt 5: protected eticketing (requires IRCTC login session cookie)
  try {
    const res = await apiRequest('get', 'eticketing', `protected/mapps1/trnscheduleenquiry/${tn}`);
    console.log('[schedule/5-protected] status:', res.status);
    const list = extract(res.data);
    if (list) return list;
  } catch (e) { console.warn('[schedule/5]', e.message); }

  return [];
};


/**
 * Coach-level vacancy overview.
 * POST /online-charts/api/trainComposition
 */
export const fetchTrainComposition = async (trainNo, jDate, boardingStation) => {
  const res = await apiRequest('post', 'charts', 'api/trainComposition', { trainNo, jDate, boardingStation });
  return res.data;
};

/**
 * Berth-level seat map for a specific coach.
 * Tries coachComposition first, falls back to vacantBerth (chartType:2).
 */
const normaliseBdd = (raw) => {
  if (raw?.bdd?.length > 0)    return { bdd: raw.bdd };
  if (Array.isArray(raw) && raw.length > 0) return { bdd: raw };
  if (raw?.berths?.length > 0) return { bdd: raw.berths };
  return null;
};

export const fetchVacantBerths = async ({
  trainNo, jDate, boardingStation, remoteStation, trainSourceStation, coachName, cls,
}) => {
  const sourceStation = remoteStation || trainSourceStation || boardingStation;

  // Attempt 1: coachComposition
  try {
    const res1 = await apiRequest('post', 'charts', 'api/coachComposition', {
      trainNo, boardingStation,
      remoteStation: sourceStation, trainSourceStation: sourceStation,
      jDate, coach: coachName, cls,
    });
    const norm = normaliseBdd(res1.data);
    if (norm) return norm;
  } catch (e) {
    console.warn('[coachComposition] falling back to vacantBerth:', e.message);
  }

  // Attempt 2: vacantBerth
  const res2 = await apiRequest('post', 'charts', 'api/vacantBerth', {
    trainNo, boardingStation,
    remoteStation: sourceStation, trainSourceStation: sourceStation,
    jDate, cls, chartType: 2,
  });
  return normaliseBdd(res2.data) ?? { bdd: [] };
};
