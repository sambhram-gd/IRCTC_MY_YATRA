import axios from 'axios';

// Proxy routes (Vite dev server forwards these to irctc.co.in):
// /proxy/charts       → /online-charts
// /proxy/eticketing   → /eticketing

const charts = axios.create({ baseURL: '/proxy/charts', withCredentials: true });
const eticketing = axios.create({ baseURL: '/proxy/eticketing', withCredentials: true });

/**
 * Fetch full train list → ["20688 - SBC UBL SF EXP", ...]
 * IRCTC returns content-type: application/javascript, so we force-parse.
 * GET /eticketing/trainList
 */
export const fetchTrainList = async () => {
  const res = await eticketing.get('/trainList', {
    headers: { accept: 'application/json, text/plain, */*' },
    transformResponse: [(data) => {
      if (Array.isArray(data)) return data;
      if (typeof data === 'string') {
        let clean = data.trim();
        // Handle JS variable assignment if present (e.g., var trainList = [...]; or window.trainList = [...];)
        if (clean.includes('=')) {
          clean = clean.substring(clean.indexOf('=') + 1).trim();
        }
        if (clean.endsWith(';')) {
          clean = clean.slice(0, -1).trim();
        }
        try {
          return JSON.parse(clean);
        } catch (e) {
          console.error('[fetchTrainList] JSON parsing failed:', e);
          // Try regex to match any JSON array/object as a fallback
          const match = clean.match(/\[[\s\S]*\]/);
          if (match) {
            try { return JSON.parse(match[0]); } catch {}
          }
          return [];
        }
      }
      return [];
    }],
  });
  return Array.isArray(res.data) ? res.data : [];
};

/**
 * Step 1: Train schedule → station list for the route dropdown.
 * GET /eticketing/protected/mapps1/trnscheduleenquiry/{trainNo}
 */
export const fetchTrainSchedule = async (trainNo) => {
  const res = await eticketing.get(
    `/protected/mapps1/trnscheduleenquiry/${trainNo.trim()}`,
    { 
      headers: { 
        accept: 'application/json',
        greq: Date.now().toString(),
        bmirak: 'webbm'
      } 
    }
  );
  const raw = res.data;
  console.log('[schedule]', raw);
  // Normalise — find the station list wherever it lives in the response
  const list =
    raw?.stationList ??
    raw?.trainScheduleDTO?.stationList ??
    raw?.stoppage ??
    (Array.isArray(raw) ? raw : null);
  return list || [];
};

/**
 * Step 2: Coach-level vacancy overview.
 * POST /online-charts/api/trainComposition
 */
export const fetchTrainComposition = async (trainNo, jDate, boardingStation) => {
  const res = await charts.post('/api/trainComposition', {
    trainNo,
    jDate,
    boardingStation,
  });
  return res.data;
};

/**
 * Berth-level seat map for a specific coach.
 *
 * IRCTC uses two different endpoints depending on the train/chart type:
 *   1. POST /online-charts/api/coachComposition  (most trains, includes coach name)
 *   2. POST /online-charts/api/vacantBerth       (some trains, uses chartType:2)
 *
 * We try coachComposition first; if it returns empty bdd we fall back to vacantBerth.
 * Both return { bdd: [...] } after normalisation.
 */
const normaliseBdd = (raw) => {
  if (raw?.bdd && raw.bdd.length > 0) return { bdd: raw.bdd };
  if (Array.isArray(raw) && raw.length > 0) return { bdd: raw };
  if (raw?.berths?.length > 0) return { bdd: raw.berths };
  return null; // signal: empty / no data
};

export const fetchVacantBerths = async ({
  trainNo, jDate, boardingStation, remoteStation, trainSourceStation, coachName, cls,
}) => {
  const sourceStation = remoteStation || trainSourceStation || boardingStation;

  // ── Attempt 1: coachComposition (specific to a named coach) ──────────
  try {
    const res1 = await charts.post('/api/coachComposition', {
      trainNo,
      boardingStation,
      remoteStation:      sourceStation,
      trainSourceStation: sourceStation,
      jDate,
      coach: coachName,   // e.g. "HA1" — key field for this endpoint
      cls,
    });
    console.log('[coachComposition]', res1.data);
    const norm = normaliseBdd(res1.data);
    if (norm) return norm;
  } catch (e) {
    console.warn('[coachComposition] failed, trying vacantBerth:', e.message);
  }

  // ── Attempt 2: vacantBerth (class-level, chartType:2) ─────────────────
  const res2 = await charts.post('/api/vacantBerth', {
    trainNo,
    boardingStation,
    remoteStation:      sourceStation,
    trainSourceStation: sourceStation,
    jDate,
    cls,
    chartType: 2,
  });
  console.log('[vacantBerth]', res2.data);
  return normaliseBdd(res2.data) ?? { bdd: [] };
};


