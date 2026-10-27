'use client';

import React, { useState, useMemo } from 'react';
import {
  RepeatArtistScorecard,
} from '@/lib/youtube_studio_stats_engine';
import {
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface RepeatArtistScorecardTableProps {
  scorecards: RepeatArtistScorecard[];
}

type SortField =
  | 'geometricMeanAgeMultiplier'
  | 'coversCount'
  | 'totalViews'
  | 'meanCtrPct'
  | 'meanRetentionPct'
  | 'modelWinRatePct'
  | 'decaySlopeLogViewsPerCover'
  | 'artist';

export const RepeatArtistScorecardTable: React.FC<RepeatArtistScorecardTableProps> = ({
  scorecards,
}) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('geometricMeanAgeMultiplier');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);

  // Format large numbers
  const formatViews = (val: number): string => {
    if (val >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1) + 'B';
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
    if (val >= 1_000) return (val / 1_000).toFixed(0) + 'K';
    return val.toLocaleString();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const toggleExpand = (artist: string) => {
    setExpandedArtist(expandedArtist === artist ? null : artist);
  };

  // Filter & sort scorecards
  const filteredScorecards = useMemo(() => {
    let list = [...scorecards];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.artist.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'artist') {
        valA = a.artist.toLowerCase();
        valB = b.artist.toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [scorecards, search, sortField, sortAsc]);

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Users className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Repeat Artist Scorecards & Diminishing Returns
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Evaluates multi-cover artists. Click any row to expand its chronological cover decay trajectory.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repeat artists..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 w-10"></th>
              <th
                onClick={() => handleSort('artist')}
                className="py-3 px-4 cursor-pointer hover:text-white"
              >
                <div className="flex items-center gap-1.5">
                  Artist <ArrowUpDown className="w-3 h-3 text-slate-600" />
                </div>
              </th>
              <th
                onClick={() => handleSort('coversCount')}
                className="py-3 px-3 cursor-pointer hover:text-white text-center"
              >
                <div className="flex items-center justify-center gap-1.5">
                  Covers <ArrowUpDown className="w-3 h-3 text-slate-600" />
                </div>
              </th>
              <th
                onClick={() => handleSort('geometricMeanAgeMultiplier')}
                className="py-3 px-3 cursor-pointer hover:text-white"
              >
                <div className="flex items-center gap-1.5">
                  Geom. Multiplier <ArrowUpDown className="w-3 h-3 text-slate-600" />
                </div>
              </th>
              <th
                onClick={() => handleSort('totalViews')}
                className="py-3 px-3 cursor-pointer hover:text-white"
              >
                <div className="flex items-center gap-1.5">
                  Total Views <ArrowUpDown className="w-3 h-3 text-slate-600" />
                </div>
              </th>
              <th
                onClick={() => handleSort('modelWinRatePct')}
                className="py-3 px-3 cursor-pointer hover:text-white"
              >
                <div className="flex items-center gap-1.5">
                  Win Rate <ArrowUpDown className="w-3 h-3 text-slate-600" />
                </div>
              </th>
              <th
                onClick={() => handleSort('meanCtrPct')}
                className="py-3 px-3 cursor-pointer hover:text-white"
              >
                <div className="flex items-center gap-1.5">
                  Mean CTR <ArrowUpDown className="w-3 h-3 text-slate-600" />
                </div>
              </th>
              <th
                onClick={() => handleSort('meanRetentionPct')}
                className="py-3 px-3 cursor-pointer hover:text-white"
              >
                <div className="flex items-center gap-1.5">
                  Retention <ArrowUpDown className="w-3 h-3 text-slate-600" />
                </div>
              </th>
              <th
                onClick={() => handleSort('decaySlopeLogViewsPerCover')}
                className="py-3 px-4 cursor-pointer hover:text-white text-right"
              >
                <div className="flex items-center justify-end gap-1.5">
                  Decay Trajectory <ArrowUpDown className="w-3 h-3 text-slate-600" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
            {filteredScorecards.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">
                  No repeat artists found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredScorecards.map((s) => {
                const isExpanded = expandedArtist === s.artist;
                const mult = s.geometricMeanAgeMultiplier;
                const slope = s.decaySlopeLogViewsPerCover;

                let decayBadge = (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <TrendingUp className="w-3 h-3" /> Climbing / Steady ({slope.toFixed(2)})
                  </span>
                );

                if (slope < -0.15) {
                  decayBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <TrendingDown className="w-3 h-3" /> Diminishing Returns ({slope.toFixed(2)})
                    </span>
                  );
                } else if (slope < -0.05) {
                  decayBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Minus className="w-3 h-3" /> Mild Plateau ({slope.toFixed(2)})
                    </span>
                  );
                }

                return (
                  <React.Fragment key={s.artist}>
                    <tr
                      onClick={() => toggleExpand(s.artist)}
                      className={`cursor-pointer transition-colors hover:bg-slate-800/50 ${
                        isExpanded ? 'bg-slate-800/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-slate-500">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-amber-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-white text-sm">
                        {s.artist}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 font-mono text-slate-300 font-semibold">
                          {s.coversCount}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-black text-sm ${
                            mult >= 1.25
                              ? 'text-emerald-400'
                              : mult < 0.8
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {mult.toFixed(2)}x
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {formatViews(s.totalViews)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${s.modelWinRatePct}%` }}
                            />
                          </div>
                          <span className="font-semibold text-purple-300">
                            {s.modelWinRatePct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-amber-300">
                        {s.meanCtrPct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {s.meanRetentionPct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right">
                        {decayBadge}
                      </td>
                    </tr>

                    {/* Inline Chronological Breakdown Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-950/90">
                        <td colSpan={9} className="p-4 pl-12 border-b border-slate-800">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800/80">
                              <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                                Chronological Covers for {s.artist}
                              </span>
                              <span>
                                Median: {formatViews(s.medianViews)} views • Avg Retention: {s.meanRetentionPct.toFixed(1)}%
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                              {s.chronologicalCovers.map((cover) => {
                                const cMult = cover.ageMultiplier;
                                return (
                                  <div
                                    key={cover.coverNumber}
                                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 shadow-sm"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                        Cover #{cover.coverNumber}
                                      </span>
                                      <span
                                        className={`font-black text-xs ${
                                          cMult >= 1.25
                                            ? 'text-emerald-400'
                                            : cMult < 0.8
                                            ? 'text-rose-400'
                                            : 'text-slate-300'
                                        }`}
                                      >
                                        {cMult.toFixed(2)}x
                                      </span>
                                    </div>

                                    <p className="font-semibold text-white text-xs truncate" title={cover.songTitle}>
                                      {cover.songTitle}
                                    </p>

                                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                                      <span>{formatViews(cover.views)} views</span>
                                      <span className="text-amber-400 font-sans font-semibold">
                                        {cover.ctrPct.toFixed(1)}% CTR
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      {cover.publishDate}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
