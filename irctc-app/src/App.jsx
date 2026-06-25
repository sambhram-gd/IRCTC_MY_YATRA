import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { Train, RefreshCw, AlertTriangle, CheckCircle2, Clock, Sun, Moon } from 'lucide-react';
import { fetchTrainList, fetchTrainSchedule, fetchTrainComposition, fetchVacantBerths } from './api';
import StationSelect from './components/StationSelect';
import SeatMap from './components/SeatMap';
import TrainSelect from './components/TrainSelect';

import defaultTrains from './data/trains.json';

// ─── helpers ───────────────────────────────────────────────────────────────
const CLASS_BADGE = {
  '1A': 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  '2A': 'bg-blue-500/20   text-blue-600 dark:text-blue-400',
  '3A': 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  'SL': 'bg-amber-500/20  text-amber-600 dark:text-amber-400',
  'CC': 'bg-pink-500/20   text-pink-600 dark:text-pink-400',
};

const normaliseStations = (raw) => {
  if (!raw) return [];
  // Real API returns { stationList: [...] }
  const list =
    raw.stationList ??
    raw.trainScheduleDTO?.stationList ??
    raw.viaStation ??
    raw.stoppage ??
    (Array.isArray(raw) ? raw : null);
  if (!list) return [];
  return list
    .map(s => ({
      stationCode:  s.stationCode  ?? s.stnCode ?? s.code ?? '',
      stationName:  s.stationName  ?? s.stnName ?? s.name ?? '',
      serialNumber: s.stnSerialNumber ?? s.serialNumber ?? s.slNo ?? '',
      arrival:      s.arrivalTime   ?? '',
      departure:    s.departureTime ?? '',
      distance:     s.distance      ?? '',
      day:          s.dayCount      ?? '',
    }))
    .filter(s => s.stationCode);
};

// Extract unique stations from bsd segment data and merge into existing list
const mergeStationsFromBsd = (bsd, existing) => {
  const codes = new Set(existing.map(s => s.stationCode));
  const extras = [];
  bsd.forEach(seg => {
    [seg.from, seg.to].forEach(code => {
      if (code && !codes.has(code)) {
        codes.add(code);
        extras.push({ stationCode: code, stationName: code, serialNumber: '', arrival: '', departure: '', distance: '' });
      }
    });
  });
  return extras.length > 0 ? [...existing, ...extras] : existing;
};

// ─── main ──────────────────────────────────────────────────────────────────
export default function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const [trainNo, setTrainNo]       = useState('');
  const [trainName, setTrainName]   = useState('');
  const [jDate, setJDate]           = useState(format(new Date(), 'yyyy-MM-dd'));
  const [boardingCode, setBoardingCode] = useState('');
  const [destCode, setDestCode]     = useState('');

  // Train list (initialized with local preloaded list, then updated from API/cache)
  const [trainList, setTrainList]   = useState(defaultTrains);
  const [trainListLoading, setTrainListLoading] = useState(false);

  const [stations, setStations]     = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [composition, setComposition] = useState(null);
  const [compLoading, setCompLoading] = useState(false);
  const [compError, setCompError]     = useState(null);

  const [selectedCoach, setSelectedCoach] = useState(null);
  const [bdd, setBdd]               = useState(null);
  const [bddLoading, setBddLoading] = useState(false);
  const [bddError, setBddError]     = useState(null);
  const [showSegment, setShowSegment] = useState(true);

  const [countdown, setCountdown]   = useState(60);
  const [lastUpdated, setLastUpdated] = useState(null);

  const debounceRef = useRef(null);

  // ── Fetch train list on mount, caching in localStorage ──────────────────
  useEffect(() => {
    // 1. Try loading cached list from localStorage first
    const cached = localStorage.getItem('irctc_train_list');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTrainList(parsed);
        }
      } catch (e) {
        console.warn('Failed to parse cached train list:', e);
      }
    }

    // 2. Fetch fresh list from live IRCTC endpoint in the background
    fetchTrainList()
      .then(list => {
        if (list && list.length > 0) {
          setTrainList(list);
          localStorage.setItem('irctc_train_list', JSON.stringify(list));
        }
      })
      .catch(e => {
        console.warn('Background live trainList fetch failed (using local database):', e.message);
      });
  }, []);

  // ── When train is selected from dropdown, auto-fetch its schedule ──
  const handleTrainSelect = async (no, name) => {
    setTrainNo(no);
    setTrainName(name);
    setStations([]);
    setBoardingCode('');
    setDestCode('');
    setComposition(null);
    setSelectedCoach(null);
    setBdd(null);
    if (!no) return;
    setScheduleLoading(true);

    // Helper: extract station list from any IRCTC response shape
    const extractStations = (raw) => {
      if (!raw) return null;
      const list =
        raw?.stationList ??
        raw?.trainScheduleDTO?.stationList ??
        raw?.body?.stationList ??
        raw?.stoppage ??
        raw?.haltList ??
        raw?.stations ??
        raw?.routeList ??
        (Array.isArray(raw) ? raw : null);
      return list && list.length > 0 ? list : null;
    };

    try {
      // Step 1: Try trainComposition with empty boarding → sometimes includes stationList
      const comp = await fetchTrainComposition(no, jDate, '');

      // Immediately seed from/to so user always has at least 2 stations
      const seedFromTo = (from, to) => {
        const seeds = [from, to].filter(Boolean).map(code => ({
          stationCode: code, stationName: code, serialNumber: '', arrival: '', departure: '', distance: ''
        }));
        if (seeds.length > 0) setStations(seeds);
      };
      if (comp?.from || comp?.to) seedFromTo(comp.from, comp.to);

      const compList = extractStations(comp);
      if (compList) {
        setStations(normaliseStations(compList));
        return; // got full list, done
      }
    } catch (e) {
      console.warn('[handleTrainSelect] composition fetch failed:', e.message);
    }

    // Step 2: Try dedicated schedule endpoints (multi-tier)
    try {
      const schedRaw = await fetchTrainSchedule(no);
      const list = extractStations(schedRaw) ?? (Array.isArray(schedRaw) && schedRaw.length > 0 ? schedRaw : null);
      if (list) {
        setStations(normaliseStations(list));
      }
    } catch (err) {
      console.warn('[handleTrainSelect] all schedule fetches failed:', err.message);
      // stations already seeded with from/to above — user can still proceed
    } finally {
      setScheduleLoading(false);
    }
  };


  // Get chart
  const getChart = async (silent = false) => {
    if (!trainNo || !boardingCode) return;
    if (!silent) { setCompLoading(true); setCompError(null); }
    try {
      const data = await fetchTrainComposition(trainNo.trim(), jDate, boardingCode);
      setComposition(data);
      setLastUpdated(new Date());
      setCountdown(60);

      // Seed station list from composition from/to if schedule fetch left us empty
      if (data?.from || data?.to) {
        setStations(prev => {
          const seeds = [data.from, data.to].filter(Boolean).map(code => ({
            stationCode: code, stationName: code, serialNumber: '', arrival: '', departure: '', distance: ''
          }));
          const existing = new Set(prev.map(s => s.stationCode));
          const newSeeds = seeds.filter(s => !existing.has(s.stationCode));
          return newSeeds.length > 0 ? [...prev, ...newSeeds] : prev;
        });
      }
    } catch (err) {
      const status = err?.response?.status;
      setCompError(
        status === 401 || status === 403
          ? 'IRCTC requires an active session. Open irctc.co.in in another tab, log in, then try again here.'
          : status === 404
          ? 'Train not found or chart not yet prepared for this date. Try a different date.'
          : status === 500
          ? 'IRCTC server error. Try again in a few seconds.'
          : `Could not fetch chart (${status ?? 'network error'}): ${err?.response?.data?.message ?? err.message}`
      );
    } finally {
      if (!silent) setCompLoading(false);
    }
  };

  // Auto-refresh
  useEffect(() => {
    if (!composition) return;
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { getChart(true); return 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [composition, trainNo, jDate, boardingCode]);

  // Coach click → try coachComposition first, fall back to vacantBerth
  // Which endpoint IRCTC uses depends on chart type:
  //   chartTwoFlag > 0  → train departed, uses vacantBerth (chartType:2)
  //   chartOneFlag only → pre-departure, uses coachComposition
  // Our API layer tries both automatically.
  const handleCoachClick = async (coach) => {
    if (selectedCoach?.coachName === coach.coachName) {
      setSelectedCoach(null);
      setBdd(null);
      return;
    }
    
    setSelectedCoach(coach);
    setBdd(null);
    setBddError(null);
    setBddLoading(true);

    // Auto-scroll on mobile
    if (window.innerWidth < 768) {
      setTimeout(() => {
        document.getElementById('seat-map-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    }
    try {
      const res = await fetchVacantBerths({
        trainNo:            trainNo.trim(),
        jDate,
        boardingStation:    boardingCode,
        remoteStation:      composition?.from ?? boardingCode,
        trainSourceStation: composition?.from ?? boardingCode,
        coachName:          coach.coachName,   // e.g. "HA1"
        cls:                coach.classCode,   // e.g. "2A"
      });
      setBdd(res.bdd);
      // Mine bsd station codes to enrich station dropdown
      if (res.bdd?.length > 0) {
        const allBsd = res.bdd.flatMap(b => b.bsd ?? []);
        setStations(prev => mergeStationsFromBsd(allBsd, prev));
      }
    } catch (err) {
      setBddError(`Could not load berths: ${err?.response?.data?.message ?? err.message}`);
    } finally {
      setBddLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!composition?.cdd) return null;
    const c = composition.cdd;
    return {
      total: c.length,
      withVacancy: c.filter(x => x.vacantBerths > 0).length,
      vacant: c.reduce((a, x) => a + x.vacantBerths, 0),
    };
  }, [composition]);

  const sortedCoaches = useMemo(() =>
    [...(composition?.cdd ?? [])].sort((a, b) => a.positionFromEngine - b.positionFromEngine),
  [composition]);

  const destStations = useMemo(() => {
    if (!boardingCode || stations.length === 0) return stations;
    const idx = stations.findIndex(s => s.stationCode === boardingCode);
    return idx >= 0 ? stations.slice(idx + 1) : stations;
  }, [boardingCode, stations]);

  return (
    <div className="min-h-screen pb-16 font-['Outfit'] bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Hero Section */}
      <div className="relative h-[45vh] md:h-[65vh] min-h-[400px] md:min-h-[550px] w-full bg-gray-900 flex flex-col items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img src="/hero-bg.png" alt="Indian Railway Train" className="w-full h-full object-cover opacity-80 mix-blend-luminosity dark:mix-blend-normal dark:opacity-50 animate-ken-burns" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/20 to-gray-50 dark:to-[#0a0a0a]" />
        </div>
        
        {/* Header (Absolute over hero) */}
        <header className="absolute top-0 left-0 right-0 z-40 border-b border-white/10 bg-transparent">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="My IRCTC Yatra" className="w-9 h-9 object-contain drop-shadow-lg" />
              <span className="font-bold tracking-wide text-white font-['Inter'] text-xl">My IRCTC Yatra</span>
            </div>
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <div className="flex items-center gap-2 text-xs text-white/80 bg-black/30 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                  <Clock className="w-3.5 h-3.5" />
                  {format(lastUpdated, 'HH:mm:ss')}
                  {composition && (
                    <span className="ml-1 text-green-400 font-mono font-bold">{countdown}s</span>
                  )}
                </div>
              )}
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 rounded-full text-white/80 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur-md border border-white/10 transition-all"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Hero Text */}
        <div className="relative z-10 text-center px-4 mt-10">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img src="/logo.png" alt="My IRCTC Yatra Logo" className="w-16 h-16 object-contain drop-shadow-2xl" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-2xl font-['Inter']">
            My IRCTC Yatra
          </h1>
          <p className="text-lg md:text-xl text-gray-200 max-w-2xl mx-auto font-medium drop-shadow-md">
            Real-time reservation charts, vacancy status, and premium coach layouts.
          </p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 -mt-20 relative z-50 space-y-6">

        {/* ── Search form ── */}
        <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 p-6 shadow-2xl bg-white/95 dark:bg-[#121212]/95 backdrop-blur-2xl transition-all duration-300 focus-within:shadow-[0_20px_50px_-12px_rgba(34,197,94,0.15)] focus-within:-translate-y-1 focus-within:border-green-500/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-5 items-end">
            {/* Train selector */}
            <div className="sm:col-span-2 lg:col-span-4">
              <TrainSelect
                trainList={trainList}
                value={trainNo}
                onChange={handleTrainSelect}
                loading={trainListLoading}
              />
            </div>

            {/* Date */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Journey Date</label>
              <input
                type="date"
                value={jDate}
                onChange={e => setJDate(e.target.value)}
                className="w-full bg-gray-100 dark:bg-[#121212] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-green-500 outline-none transition-all [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>

            {/* Boarding */}
            <div className="lg:col-span-4">
              <StationSelect
                label="Boarding Station"
                value={boardingCode}
                onChange={v => { setBoardingCode(v); setComposition(null); setSelectedCoach(null); setBdd(null); }}
                stations={stations}
                placeholder={scheduleLoading ? 'Loading...' : stations.length ? 'Select boarding' : 'Select train first'}
                highlight={!!trainNo && !boardingCode}
              />
            </div>

            {/* Button */}
            <div className="sm:col-span-2 lg:col-span-2 flex gap-2">
              <button
                onClick={() => getChart(false)}
                disabled={compLoading || !trainNo || !boardingCode}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors shadow-lg shadow-green-900/10"
              >
                {compLoading ? 'Loading...' : 'Get Chart'}
              </button>
            </div>
          </div>
        </div>

        {compError && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {compError}
          </div>
        )}

        {/* ── Chart status + stats ── */}
        {composition && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status */}
              <div className="glass-panel rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${composition?.chartStatusResponseDto?.chartOneFlag >= 1 ? 'bg-green-500/10 text-green-600 dark:text-green-500' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{composition.trainName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {composition?.chartStatusResponseDto?.chartOneFlag >= 1
                      ? `Chart prepared · ${composition.chartOneDate ? new Date(composition.chartOneDate).toLocaleTimeString() : ''}`
                      : 'Chart not yet prepared — data may be inaccurate'
                    }
                  </p>
                </div>
              </div>

              {/* Stats */}
              {stats && (
                <div className="glass-panel rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-around">
                  {[
                    ['COACHES', stats.total, 'text-gray-900 dark:text-white'],
                    ['VACANT', stats.withVacancy, 'text-green-600 dark:text-green-400'],
                    ['FULL', stats.total - stats.withVacancy, 'text-gray-500 dark:text-gray-400'],
                    ['BERTHS', stats.vacant, 'text-blue-600 dark:text-blue-400'],
                  ].map(([label, val, cls], i) => (
                    <div key={label} className={`text-center animate-count-up delay-${Math.min(i, 10)}`}>
                      <p className={`text-2xl font-black ${cls}`}>{val}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-500 font-semibold tracking-widest mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Coach strip ── */}
            <div className="glass-panel rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-300">
                  <Train className="w-4 h-4 text-gray-500" /> Train Layout
                </h2>
                <span className="text-[10px] text-gray-500 dark:text-gray-600 tracking-widest uppercase">← Engine</span>
              </div>

              <div className="flex gap-2.5 overflow-x-auto pb-3 snap-x">
                {sortedCoaches.map((coach, i) => {
                  const isSel = selectedCoach?.coachName === coach.coachName;
                  const full  = coach.vacantBerths === 0;
                  return (
                    <button
                      key={i}
                      onClick={() => handleCoachClick(coach)}
                      className={`snap-center shrink-0 w-20 rounded-xl border flex flex-col items-center justify-center py-3 gap-1 relative overflow-hidden transition-all duration-300 hover:scale-105 hover:-translate-y-1 animate-slide-in-stagger delay-${Math.min(i, 10)}
                        ${isSel ? 'border-green-500 bg-green-50 dark:bg-green-500/10 ring-1 ring-green-500/50 shadow-lg shadow-green-500/20' :
                          full   ? 'border-red-200 dark:border-red-900/40 bg-gray-50/50 dark:bg-[#111]/50 hover:border-red-300 dark:hover:border-red-800/60' :
                                   'border-gray-300 dark:border-gray-800 bg-white dark:bg-[#111] hover:border-gray-400 dark:hover:border-gray-600 hover:shadow-lg'}`}
                    >
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${CLASS_BADGE[coach.classCode] ?? 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                        {coach.classCode}
                      </span>
                      <span className={`text-xl font-black ${full ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>{coach.coachName}</span>
                      <span className={`text-[10px] font-semibold ${full ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`}>
                        {coach.vacantBerths}
                      </span>
                      {/* vacancy bar */}
                      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gray-200 dark:bg-gray-800">
                        <div className={`h-full ${full ? 'bg-red-500' : 'bg-green-500'}`}
                          style={{ width: full ? '100%' : `${Math.min(100, coach.vacantBerths * 3)}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Seat Map ── */}
            {selectedCoach && (
              <div id="seat-map-container" className="glass-panel rounded-xl border border-gray-200 dark:border-gray-800 p-5 mt-4 scroll-mt-6 animate-in fade-in slide-in-from-top-4 duration-500 ease-out">
                <div className="flex items-center gap-3 mb-5">
                  <h2 className="font-bold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    Coach <span className="text-gray-900 dark:text-white">{selectedCoach.coachName}</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${CLASS_BADGE[selectedCoach.classCode] ?? 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                      {selectedCoach.classCode}
                    </span>
                  </h2>
                  <span className="text-xs text-gray-500 ml-auto">
                    {selectedCoach.vacantBerths} vacant berths
                  </span>
                </div>

                {bddLoading && (
                  <div className="h-52 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-gray-500 dark:text-gray-600">Fetching berth map…</p>
                  </div>
                )}

                {bddError && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {bddError}
                  </div>
                )}

                {!bddLoading && !bddError && bdd && (
                  <SeatMap bdd={bdd} classCode={selectedCoach.classCode} />
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
