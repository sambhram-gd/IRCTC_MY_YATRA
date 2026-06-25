import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Train, ChevronDown, Check } from 'lucide-react';

export default function TrainSelect({ trainList, value, onChange, loading }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  // Parse "20688 - SBC UBL SF EXP" -> { no: "20688", name: "SBC UBL SF EXP" }
  const parse = (str = '') => {
    const idx = str.indexOf(' - ');
    if (idx === -1) return { no: str.trim(), name: '' };
    return { no: str.slice(0, idx).trim(), name: str.slice(idx + 3).trim() };
  };

  // Find train display label
  const getDisplayLabel = (val) => {
    if (!val) return '';
    const match = trainList.find(t => t.startsWith(val + ' - '));
    return match || val;
  };

  // Sync query when value changes
  useEffect(() => {
    setQuery(getDisplayLabel(value));
  }, [value, trainList]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        // Reset query to current selection display label on blur
        setQuery(getDisplayLabel(value));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, trainList]);

  // Filter list based on user query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trainList.slice(0, 100);

    // Sort matching trains: exact prefix first, then startsWith, then includes
    return trainList
      .filter(t => t.toLowerCase().includes(q))
      .sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        if (aLower.startsWith(q) && !bLower.startsWith(q)) return -1;
        if (!aLower.startsWith(q) && bLower.startsWith(q)) return 1;
        return aLower.localeCompare(bLower);
      })
      .slice(0, 100);
  }, [query, trainList]);

  const selectTrain = (str) => {
    const { no, name } = parse(str);
    onChange(no, name);
    setQuery(str);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', '');
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) {
        // If there's an exact or close match in filtered list, select first
        selectTrain(filtered[0]);
      } else if (query.trim()) {
        // Fallback: direct manual entry
        const q = query.trim();
        const { no, name } = parse(q);
        onChange(no, name);
        setOpen(false);
      }
    }
  };

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
        <span>Train Number / Name</span>
        {loading && <span className="text-[10px] text-green-600 dark:text-green-500 animate-pulse">Loading database...</span>}
        {!loading && trainList.length > 0 && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal normal-case">{trainList.length.toLocaleString()} trains loaded</span>
        )}
      </label>

      <div className="relative">
        <Train className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search train no. (e.g. 20688) or name..."
          className="w-full bg-gray-100 dark:bg-[#121212] border border-gray-300 dark:border-gray-700 rounded-lg pl-9 pr-16 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-600 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all"
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
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="p-1 rounded-full text-gray-500 hover:text-white transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute z-[100] top-full mt-1.5 left-0 w-[320px] sm:w-[420px] md:w-[480px] max-w-[90vw] bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 rounded-lg shadow-2xl overflow-hidden max-h-72 flex flex-col">
          <div className="overflow-y-auto flex-1">
            {/* If query looks like a train number and not found in list, show fallback option */}
            {query.trim() && /^\d+$/.test(query.trim()) && !trainList.some(t => t.startsWith(query.trim())) && (
              <button
                type="button"
                onClick={() => {
                  onChange(query.trim(), '');
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5 text-left border-b border-gray-800/50 text-amber-500 font-medium"
              >
                <Search className="w-4 h-4 text-amber-500" />
                <span>Use number "{query.trim()}" directly</span>
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <p className="text-sm text-gray-500">No matching trains found</p>
                {query.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      const { no, name } = parse(query);
                      onChange(no, name);
                      setOpen(false);
                    }}
                    className="mt-2 text-xs text-green-500 hover:underline"
                  >
                    Select "{query}" anyway
                  </button>
                )}
              </div>
            ) : (
              filtered.map((t, idx) => {
                const { no, name } = parse(t);
                const isSelected = value === no;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectTrain(t)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left border-b border-gray-100 dark:border-gray-800/40 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${
                      isSelected ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded shrink-0">
                        {no}
                      </span>
                      <span className="truncate text-gray-900 dark:text-zinc-100 font-medium">{name}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-green-500 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>

          {filtered.length > 0 && (
            <div className="bg-gray-50 dark:bg-[#121212] px-4 py-1.5 border-t border-gray-200 dark:border-gray-800 text-[10px] text-gray-500 dark:text-gray-600 text-center">
              Showing top {filtered.length} matches
            </div>
          )}
        </div>
      )}
    </div>
  );
}
