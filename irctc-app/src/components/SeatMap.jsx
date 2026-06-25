import React, { useState, useMemo } from 'react';
import { X, ChevronRight } from 'lucide-react';

// ─── Berth status helpers ───────────────────────────────────────────────────
const getBerthStatus = (berth) => {
  const bsd = berth?.bsd;
  if (!berth?.enable) return 'DISABLED';
  if (!bsd || bsd.length === 0) return 'UNKNOWN';
  const hasBooked = bsd.some(s => s.occupancy);
  const hasFree   = bsd.some(s => !s.occupancy);
  if (hasBooked && hasFree)  return 'PARTIAL';
  if (hasBooked)             return 'BOOKED';
  return 'AVAILABLE';
};

const STATUS = {
  AVAILABLE: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20',
    border: 'border-emerald-200 dark:border-emerald-500/50',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    glow: 'shadow-[0_0_8px_rgba(16,185,129,0.2)] dark:shadow-emerald-500/10'
  },
  BOOKED: {
    bg: 'bg-red-50 dark:bg-red-950/10 hover:bg-red-100 dark:hover:bg-red-950/20',
    border: 'border-red-200 dark:border-red-900/30',
    text: 'text-red-400 dark:text-red-500',
    dot: 'bg-red-400 dark:bg-red-800',
    glow: 'shadow-transparent'
  },
  PARTIAL: {
    bg: 'bg-cyan-50 dark:bg-cyan-500/15 hover:bg-cyan-100 dark:hover:bg-cyan-500/25',
    border: 'border-cyan-200 dark:border-cyan-500/50',
    text: 'text-cyan-700 dark:text-cyan-400',
    dot: 'bg-cyan-500 dark:bg-cyan-400',
    glow: 'shadow-[0_0_8px_rgba(6,182,212,0.2)] dark:shadow-cyan-500/10'
  },
  DISABLED: {
    bg: 'bg-gray-100 dark:bg-gray-900/40',
    border: 'border-gray-200 dark:border-gray-800',
    text: 'text-gray-400 dark:text-gray-500',
    dot: 'bg-gray-300 dark:bg-gray-700',
    glow: 'shadow-transparent'
  },
  UNKNOWN: {
    bg: 'bg-gray-100 dark:bg-gray-800/20 hover:bg-gray-200 dark:hover:bg-gray-800/30',
    border: 'border-gray-300 dark:border-gray-700',
    text: 'text-gray-500 dark:text-gray-400',
    dot: 'bg-gray-400 dark:bg-gray-500',
    glow: 'shadow-transparent'
  },
};

// ─── Single berth cell ──────────────────────────────────────────────────────
function BerthCell({ berth, active, onSelect }) {
  if (!berth) {
    return (
      <div className="w-11 h-10 rounded border border-dashed border-gray-300 dark:border-gray-800/50 opacity-50 dark:opacity-20 bg-gray-50 dark:bg-black/25 flex items-center justify-center">
        <span className="text-[8px] text-gray-400 dark:text-gray-700 font-mono">VAC</span>
      </div>
    );
  }

  const status = getBerthStatus(berth);
  const s = STATUS[status];
  const isActive = active === berth.berthNo;

  const getBerthTypeLabel = (code) => {
    switch (code) {
      case 'L': return 'LOWER';
      case 'M': return 'MIDDLE';
      case 'U': return 'UPPER';
      case 'SL': case 'P': return 'S-LOWER';
      case 'SU': case 'R': return 'S-UPPER';
      case 'WS': return 'WINDOW';
      case 'MS': return 'MIDDLE';
      case 'AS': return 'AISLE';
      default: return code;
    }
  };

  const getLabelColor = (code) => {
    switch (code) {
      case 'L': return 'text-emerald-600 dark:text-emerald-400';
      case 'M': return 'text-amber-600 dark:text-amber-400';
      case 'U': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-purple-600 dark:text-purple-400';
    }
  };

  return (
    <button
      onClick={() => onSelect(isActive ? null : berth)}
      disabled={status === 'DISABLED'}
      className={`
        w-12 h-11 rounded-lg border flex flex-col items-center justify-between py-1.5 px-1
        transition-all duration-200 relative shadow-sm
        ${s.bg} ${s.border} ${s.text} ${s.glow}
        ${status !== 'DISABLED' ? 'cursor-pointer hover:brightness-125 hover:-translate-y-0.5 active:scale-95' : 'cursor-not-allowed opacity-30'}
        ${isActive ? 'ring-2 ring-white/40 brightness-125 scale-105 z-10' : ''}
      `}
    >
      {/* Berth Number */}
      <span className="text-[13px] font-black tracking-tight leading-none text-gray-900 dark:text-gray-100">{berth.berthNo}</span>

      {/* Berth Type Label */}
      <span className={`text-[7px] font-bold tracking-wider leading-none uppercase ${getLabelColor(berth.berthCode)}`}>
        {getBerthTypeLabel(berth.berthCode)}
      </span>

      {/* Status indicator dot */}
      <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${s.dot}`} />
    </button>
  );
}

// ─── Berth detail panel ─────────────────────────────────────────────────────
function BerthDetail({ berth, onClose }) {
  if (!berth) return null;
  const status = getBerthStatus(berth);
  const s = STATUS[status];

  const getFullBerthName = (code) => {
    if (code === 'L') return 'Lower Berth';
    if (code === 'M') return 'Middle Berth';
    if (code === 'U') return 'Upper Berth';
    if (code === 'SL' || code === 'P') return 'Side Lower Berth';
    if (code === 'SU' || code === 'R') return 'Side Upper Berth';
    if (code === 'WS') return 'Window Seat';
    if (code === 'MS') return 'Middle Seat';
    if (code === 'AS') return 'Aisle Seat';
    return `Seat/Berth (${code})`;
  };

  return (
    <div className="fixed bottom-0 right-0 md:top-0 w-full md:w-80 h-[65vh] md:h-full bg-white dark:bg-[#111111] md:border-l border-t md:border-t-0 border-gray-200 dark:border-gray-800 z-[100] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.2)] md:shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-right duration-300 rounded-t-3xl md:rounded-none">
      
      {/* Mobile drag handle */}
      <div className="md:hidden w-full flex justify-center pt-3 pb-1 cursor-pointer" onClick={onClose}>
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pb-4 pt-2 md:pt-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-gray-900 dark:text-white">Berth #{berth.berthNo}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.border} border ${s.text}`}>
              {berth.berthCode}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{getFullBerthName(berth.berthCode)}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Status badge */}
      <div className={`mx-5 mt-5 px-4 py-3 rounded-lg border ${s.bg} ${s.border} flex items-center gap-3`}>
        <span className={`w-2.5 h-2.5 rounded-full ${s.dot} shrink-0`} />
        <div>
          <p className={`font-bold text-sm uppercase ${s.text}`}>{status}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {status === 'AVAILABLE' ? 'Fully vacant for the selected journey.' :
             status === 'BOOKED'    ? 'Fully occupied.' :
             status === 'PARTIAL'   ? 'Vacant on some segments, occupied on others.' : 'No active reservation details.'}
          </p>
        </div>
      </div>

      {/* Segment breakdown */}
      <div className="flex-1 overflow-y-auto px-5 mt-5">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Journey Segments</p>
        {(!berth.bsd || berth.bsd.length === 0) ? (
          <p className="text-gray-500 dark:text-gray-600 text-sm text-center py-8">No segments loaded</p>
        ) : (
          <div className="space-y-2">
            {berth.bsd.map((seg, i) => (
              <div key={i} className={`rounded-lg border px-4 py-3 flex items-center justify-between
                ${seg.occupancy
                  ? 'bg-red-500/5 border-red-950/40'
                  : 'bg-emerald-500/5 border-emerald-950/40'}`}>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">{seg.from}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600" />
                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">{seg.to}</span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md
                  ${seg.occupancy
                    ? 'bg-red-500/10 text-red-400 border border-red-900/30'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-900/30'}`}>
                  {seg.occupancy ? 'BOOKED' : 'VACANT'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0d0d0d]">
        <p className="text-[10px] text-gray-500 text-center font-medium">Click another seat to view or close panel</p>
      </div>
    </div>
  );
}

// ─── Main SeatMap ───────────────────────────────────────────────────────────
export default function SeatMap({ bdd, classCode }) {
  const [selectedBerth, setSelectedBerth] = useState(null);

  const isChairCar = useMemo(() => {
    if (!classCode) return false;
    const code = classCode.toUpperCase();
    return ['CC', '2S', 'EC', 'EV', 'EA', 'VS'].includes(code);
  }, [classCode]);

  // Group berths by cabinCoupeNameNo (bays) or by row for chair cars
  const bays = useMemo(() => {
    if (isChairCar) {
      const code = classCode.toUpperCase();
      const seatsPerRow = code === '2S' ? 6 : code === 'EC' ? 4 : 5;
      const sorted = [...bdd].sort((a, b) => a.berthNo - b.berthNo);
      const rows = [];
      for (let i = 0; i < sorted.length; i += seatsPerRow) {
        rows.push([`${Math.floor(i / seatsPerRow) + 1}`, sorted.slice(i, i + seatsPerRow)]);
      }
      return rows;
    } else {
      const map = new Map();
      bdd.forEach(b => {
        const key = b.cabinCoupeNameNo ?? '0';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(b);
      });
      return Array.from(map.entries()).sort((a, b) => +a[0] - +b[0]);
    }
  }, [bdd, isChairCar, classCode]);

  const stats = useMemo(() => {
    const total     = bdd.length;
    const available = bdd.filter(b => getBerthStatus(b) === 'AVAILABLE').length;
    const booked    = bdd.filter(b => getBerthStatus(b) === 'BOOKED').length;
    const partial   = bdd.filter(b => getBerthStatus(b) === 'PARTIAL').length;
    return { total, available, booked, partial };
  }, [bdd]);

  // Determine if this class has middle berths (SL and 3A have middle berths, 2A/1A do not)
  const hasMiddle = useMemo(() => {
    if (!classCode) return true;
    const code = classCode.toUpperCase();
    return code === 'SL' || code === '3A' || code.includes('3');
  }, [classCode]);

  return (
    <div className="flex flex-col select-none">
      {/* Stats and Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 text-xs bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-gray-800 rounded-lg p-3">
        <div className="flex gap-5">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black text-gray-900 dark:text-gray-100">{stats.total}</span>
            <span className="text-gray-500 font-medium">Berths</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black text-emerald-400">{stats.available}</span>
            <span className="text-emerald-500/80 font-medium">Vacant</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black text-red-500">{stats.booked}</span>
            <span className="text-red-500/80 font-medium font-medium">Booked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black text-cyan-400">{stats.partial}</span>
            <span className="text-cyan-500/80 font-medium">Partially Vacant</span>
          </div>
        </div>
        <div className="text-[10px] text-gray-500 font-medium italic">
          Click on any seat to see station-level segment availability
        </div>
      </div>

      {/* Train Coach Container Shell */}
      <div className="relative border border-gray-300 dark:border-gray-700/80 bg-gray-100 dark:bg-[#080808] rounded-2xl p-1 shadow-inner overflow-hidden">
        
        {/* Windows and shell styling decoration */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-b from-gray-200 dark:from-gray-700/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-t from-gray-200 dark:from-gray-700/50 to-transparent" />

        {/* Scrollable coach layout inner */}
        <div className="overflow-x-auto pb-4 pt-3 px-1 custom-scrollbar">
          <div className="flex items-stretch min-w-max">
            
            {/* LEFT TOILET & VESTIBULE BLOCK */}
            <div className="w-16 shrink-0 bg-white dark:bg-zinc-900/60 border border-gray-300 dark:border-gray-800 rounded-lg flex flex-col justify-between p-2 text-center text-[10px] text-gray-500 dark:text-gray-600 font-bold uppercase tracking-wider select-none mr-2">
              <div className="py-2 border-b border-gray-200 dark:border-gray-800/50">Toilet</div>
              <div className="flex-1 flex items-center justify-center text-[9px] text-gray-400 dark:text-gray-500 my-4 border-y border-dashed border-gray-300 dark:border-gray-800/80">Door</div>
              <div className="py-2 border-t border-gray-200 dark:border-gray-800/50">Toilet</div>
            </div>

            {/* COACH BAYS */}
            <div className="flex gap-2">
              {bays.map(([coupeId, berths]) => {
                const sorted = [...berths].sort((a, b) => a.berthNo - b.berthNo);

                // Side berths (R, P, SU, SL)
                const sideBerths = sorted.filter(b => ['R', 'P', 'SU', 'SL'].includes(b.berthCode));
                // Sort side berths: Side Lower first, then Side Upper
                const sideLower = sideBerths.find(b => b.berthCode === 'SL' || b.berthCode === 'P');
                const sideUpper = sideBerths.find(b => b.berthCode === 'SU' || b.berthCode === 'R');

                // If it's a chair car, ALL seats in the row are "main berths"
                const mainBerths = isChairCar ? sorted : sorted.filter(b => !['R', 'P', 'SU', 'SL'].includes(b.berthCode));
                
                // Split main berths into two columns (facing sides for sleeper, or left/right aisle for chair car)
                // If CC, usually 2 on left, 3 on right (so halfLength = 2). If 2S, 3 on left, 3 on right.
                const halfLength = isChairCar && classCode.toUpperCase() === 'CC' ? 2 : Math.ceil(mainBerths.length / 2);
                const colABerths = mainBerths.slice(0, halfLength);
                const colBBerths = mainBerths.slice(halfLength);

                // Sort columns: For sleeper (U, M, L). For Chair car, just use natural order.
                const sortMainColumn = (cols) => {
                  if (isChairCar) return cols;
                  const ordered = [];
                  const u = cols.find(b => b.berthCode === 'U');
                  const m = cols.find(b => b.berthCode === 'M');
                  const l = cols.find(b => b.berthCode === 'L');
                  
                  if (u) ordered.push(u);
                  if (hasMiddle && m) ordered.push(m);
                  if (l) ordered.push(l);
                  return ordered.length > 0 ? ordered : cols;
                };

                const colAOrdered = sortMainColumn(colABerths);
                const colBOrdered = sortMainColumn(colBBerths);

                return (
                  <div key={coupeId} className="flex flex-col bg-white dark:bg-[#0b0b0b]/60 border border-gray-300 dark:border-gray-800/60 rounded-xl p-2.5 relative min-w-[124px]">
                    
                    {/* Bay Label Header */}
                    <div className="text-[9px] text-gray-500 font-bold tracking-widest text-center mb-2 border-b border-gray-200 dark:border-gray-900 pb-1 flex items-center justify-center gap-1">
                      <span>{isChairCar ? 'ROW' : 'BAY'}</span>
                      <span className="text-gray-700 dark:text-gray-300 font-black">{coupeId}</span>
                    </div>

                    {!isChairCar && (
                      <>
                        {/* TOP SECTION: Side Berths (horizontal side-by-side) */}
                        <div className="flex gap-1.5 justify-center mb-3">
                          <div className="relative group">
                            <BerthCell berth={sideLower} active={selectedBerth?.berthNo} onSelect={setSelectedBerth} />
                          </div>
                          <div className="relative group">
                            <BerthCell berth={sideUpper} active={selectedBerth?.berthNo} onSelect={setSelectedBerth} />
                          </div>
                        </div>

                        {/* MIDDLE SECTION: Corridor separator with horizontal track lines */}
                        <div className="h-6 my-1.5 flex items-center justify-center relative bg-gray-50 dark:bg-zinc-950/80 border-y border-dashed border-gray-300 dark:border-gray-800 rounded">
                          <span className="text-[8px] font-black text-gray-400 dark:text-gray-600 tracking-[0.25em] uppercase select-none">Corridor</span>
                          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-gray-200 dark:border-gray-900/40 pointer-events-none" />
                        </div>
                      </>
                    )}

                    {/* BOTTOM SECTION: Main compartments (facing columns) */}
                    <div className="flex justify-between gap-3 px-0.5">
                      
                      {/* Left Column (triplet/pair A) */}
                      <div className="flex flex-col gap-1.5">
                        {colAOrdered.map((b, idx) => (
                          <BerthCell key={b?.berthNo ?? idx} berth={b} active={selectedBerth?.berthNo} onSelect={setSelectedBerth} />
                        ))}
                      </div>

                      {/* Compartment Center Divider Line */}
                      <div className="w-px bg-gradient-to-b from-gray-200 via-gray-300 dark:from-gray-900 dark:via-gray-800/40 to-gray-200 dark:to-gray-900 self-stretch my-1" />

                      {/* Right Column (triplet/pair B) */}
                      <div className="flex flex-col gap-1.5">
                        {colBOrdered.map((b, idx) => (
                          <BerthCell key={b?.berthNo ?? idx} berth={b} active={selectedBerth?.berthNo} onSelect={setSelectedBerth} />
                        ))}
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>

            {/* RIGHT TOILET & VESTIBULE BLOCK */}
            <div className="w-16 shrink-0 bg-white dark:bg-zinc-900/60 border border-gray-300 dark:border-gray-800 rounded-lg flex flex-col justify-between p-2 text-center text-[10px] text-gray-500 dark:text-gray-600 font-bold uppercase tracking-wider select-none ml-2">
              <div className="py-2 border-b border-gray-200 dark:border-gray-800/50">Toilet</div>
              <div className="flex-1 flex items-center justify-center text-[9px] text-gray-400 dark:text-gray-500 my-4 border-y border-dashed border-gray-300 dark:border-gray-800/80">Door</div>
              <div className="py-2 border-t border-gray-200 dark:border-gray-800/50">Toilet</div>
            </div>

          </div>
        </div>

      </div>

      {/* Legend Block */}
      <div className="flex flex-wrap items-center gap-6 mt-4 p-3 bg-gray-50 dark:bg-white/[0.01] border border-gray-300 dark:border-gray-900 rounded-lg">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Legend</span>
        {[
          ['bg-emerald-500 dark:bg-emerald-400', 'border-emerald-200 dark:border-emerald-500/50', 'Vacant'],
          ['bg-red-400 dark:bg-red-800', 'border-red-200 dark:border-red-900/30', 'Booked'],
          ['bg-cyan-500 dark:bg-cyan-400', 'border-cyan-200 dark:border-cyan-500/50', 'Partially Vacant (Split)'],
        ].map(([dot, border, label]) => (
          <span key={label} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 font-medium">
            <span className={`w-2.5 h-2.5 rounded-full ${dot} border ${border}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Detail panel — fixed slide-in from right */}
      {selectedBerth && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[99] backdrop-blur-[3px] transition-all animate-in fade-in duration-200"
            onClick={() => setSelectedBerth(null)}
          />
          <BerthDetail berth={selectedBerth} onClose={() => setSelectedBerth(null)} />
        </>
      )}
    </div>
  );
}
