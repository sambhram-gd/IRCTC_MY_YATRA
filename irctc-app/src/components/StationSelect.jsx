import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, X, ChevronDown, Check } from 'lucide-react';

export default function StationSelect({ label, value, onChange, stations = [], placeholder, highlight = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  // Find currently selected station details
  const selectedStation = useMemo(() => {
    return stations.find(s => s.stationCode === value);
  }, [value, stations]);

  // Set initial query to display label
  useEffect(() => {
    if (selectedStation) {
      setQuery(`${selectedStation.stationCode} — ${selectedStation.stationName}`);
    } else {
      setQuery(value || '');
    }
  }, [value, selectedStation]);

  // Close dropdown on click outside
  useEffect(() => {
    const clickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        // Reset query input to match actual selection on blur
        if (selectedStation) {
          setQuery(`${selectedStation.stationCode} — ${selectedStation.stationName}`);
        } else {
          setQuery(value || '');
        }
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [value, selectedStation]);

  // Filter stations based on search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;

    // Filter by matching station code or name
    return stations.filter(s => 
      s.stationCode?.toLowerCase().includes(q) ||
      s.stationName?.toLowerCase().includes(q)
    );
  }, [query, stations]);

  const selectStation = (station) => {
    onChange(station.stationCode);
    setQuery(`${station.stationCode} — ${station.stationName}`);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) {
        selectStation(filtered[0]);
      } else if (query.trim()) {
        const val = query.trim().toUpperCase();
        onChange(val);
        setOpen(false);
      }
    }
  };

  // If no stations loaded, behave as a free-text uppercase input
  const isFallback = stations.length === 0;

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => !isFallback && setOpen(true)}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            if (isFallback) {
              onChange(val.toUpperCase());
            } else {
              setOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || (isFallback ? 'Type station code (e.g. SBC)...' : 'Search station...')}
          className={`w-full rounded-lg pl-9 pr-16 py-2.5 text-sm outline-none transition-all uppercase ${
            highlight
              ? 'bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-500 text-gray-900 dark:text-white placeholder-amber-700/50 dark:placeholder-amber-500/50 focus:ring-2 focus:ring-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
              : 'bg-gray-100 dark:bg-[#121212] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-600 focus:border-green-500 focus:ring-1 focus:ring-green-500'
          }`}
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {!isFallback && (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="p-1 rounded-full text-gray-500 hover:text-white transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {open && !isFallback && (
        <div className="absolute z-[100] top-full mt-1.5 left-0 w-[300px] sm:w-[360px] md:w-[420px] max-w-[90vw] bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 rounded-lg shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-6 px-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-500">No stations found on route</p>
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(query.trim().toUpperCase());
                    setOpen(false);
                  }}
                  className="mt-2 text-xs text-green-500 hover:underline block mx-auto"
                >
                  Use "{query.trim().toUpperCase()}" directly
                </button>
              )}
            </div>
          ) : (
            filtered.map((s, i) => {
              const isSelected = value === s.stationCode;
              return (
                <button
                  key={s.stationCode + i}
                  type="button"
                  onClick={() => selectStation(s)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left border-b border-gray-100 dark:border-gray-800/40 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${
                    isSelected ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 px-2 py-0.5 rounded shrink-0">
                      {s.stationCode}
                    </span>
                    <span className="truncate text-gray-900 dark:text-zinc-100 font-medium">{s.stationName}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0">
                    {(s.arrival || s.departure) && (
                      <div className="flex flex-col items-end shrink-0">
                        {s.day && <span className="text-[9px] text-gray-500">Day {s.day}</span>}
                        <span className="text-xs font-mono text-gray-700 dark:text-gray-400">
                          {s.arrival && s.arrival !== '--' ? s.arrival : s.departure}
                        </span>
                      </div>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-500 shrink-0" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
