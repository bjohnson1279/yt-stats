'use client';

import React, { useState, useMemo } from 'react';
import {
  EnrichedVideoAnalytics,
  pearsonCorrelation,
  spearmanRankCorrelation,
  median,
} from '@/lib/youtube_studio_stats_engine';
import {
  Activity,
  Flame,
  AlertOctagon,
  EyeOff,
  Clock,
  CheckCircle,
  Filter,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';

interface FunnelDiagnosticsTableProps {
  videos: EnrichedVideoAnalytics[];
}

export const FunnelDiagnosticsTable: React.FC<FunnelDiagnosticsTableProps> = ({
  videos,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Format large numbers
  const formatViews = (val: number): string => {
    if (val >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1) + 'B';
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
    if (val >= 1_000) return (val / 1_000).toFixed(0) + 'K';
    return val.toLocaleString();
  };

  // Channel medians for comparison
  const { medianCtr, medianRetention, medianImpressions } = useMemo(() => {
    if (!videos || videos.length === 0) {
      return { medianCtr: 0, medianRetention: 0, medianImpressions: 0 };
    }
    return {
      medianCtr: median(videos.map((v) => v.impressionsCtrPct)),
      medianRetention: median(videos.map((v) => v.averagePercentageViewed)),
      medianImpressions: median(videos.map((v) => v.impressions)),
    };
  }, [videos]);

  // Compute Correlation Matrix between log10(Views) and the 4 key funnel drivers
  const correlations = useMemo(() => {
    if (!videos || videos.length < 3) {
      return {
        ctr: { r: 0, rho: 0 },
        retention: { r: 0, rho: 0 },
        subscribers: { r: 0, rho: 0 },
        repeatOrder: { r: 0, rho: 0 },
      };
    }

    const logViews = videos.map((v) => v.log10Views);
    const ctr = videos.map((v) => v.impressionsCtrPct);
    const retention = videos.map((v) => v.averagePercentageViewed);
    const subsPer1k = videos.map((v) => v.subscribersPer1kViews);

    // Filter videos with valid repeat cover appearances for repeat correlation
    const repeatVids = videos.filter((v) => v.artistAppearanceNumber !== undefined);
    const repeatLogViews = repeatVids.map((v) => v.log10Views);
    const repeatNumbers = repeatVids.map((v) => v.artistAppearanceNumber!);

    return {
      ctr: {
        r: pearsonCorrelation(logViews, ctr),
        rho: spearmanRankCorrelation(logViews, ctr),
      },
      retention: {
        r: pearsonCorrelation(logViews, retention),
        rho: spearmanRankCorrelation(logViews, retention),
      },
      subscribers: {
        r: pearsonCorrelation(logViews, subsPer1k),
        rho: spearmanRankCorrelation(logViews, subsPer1k),
      },
      repeatOrder: {
        r: repeatVids.length > 2 ? pearsonCorrelation(repeatLogViews, repeatNumbers) : 0,
        rho: repeatVids.length > 2 ? spearmanRankCorrelation(repeatLogViews, repeatNumbers) : 0,
      },
    };
  }, [videos]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: videos.length,
      'Breakout Hit': 0,
      'Subscriber Fatigue (Low CTR)': 0,
      'AlgorithmCapped (Low Impressions)': 0,
      'Retention Drop (Low AVD)': 0,
      'Baseline Performer': 0,
    };
    videos.forEach((v) => {
      counts[v.funnelBottleneck] = (counts[v.funnelBottleneck] || 0) + 1;
    });
    return counts;
  }, [videos]);

  // Filtered list
  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      if (selectedCategory !== 'ALL' && v.funnelBottleneck !== selectedCategory) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          v.videoTitle.toLowerCase().includes(q) ||
          v.parsedArtist?.toLowerCase().includes(q) ||
          v.parsedSongTitle?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [videos, selectedCategory, search]);

  const renderCorrBadge = (r: number, rho: number, label: string, desc: string) => {
    const isStrongPos = r >= 0.4;
    const isStrongNeg = r <= -0.25;

    return (
      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span className="font-semibold text-slate-300">{label}</span>
          <span
            className={`font-mono font-bold ${
              isStrongPos
                ? 'text-emerald-400'
                : isStrongNeg
                ? 'text-rose-400'
                : 'text-slate-300'
            }`}
          >
            r = {r >= 0 ? `+${r.toFixed(2)}` : r.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Spearman ρ:</span>
          <span>{rho >= 0 ? `+${rho.toFixed(2)}` : rho.toFixed(2)}</span>
        </div>
        <p className="text-[10px] text-slate-400 pt-0.5 leading-snug">{desc}</p>
      </div>
    );
  };

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Activity className="w-5 h-5" />
          </span>
          <h3 className="text-lg font-bold text-white tracking-tight">
            YouTube Funnel Bottleneck Diagnostics & Correlation Matrix
          </h3>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Ground truth algorithmic diagnostics: identifies whether underperformance stems from thumbnail fatigue (Low CTR), algorithmic gating (Low Impressions), or watch time dropoff (Low AVD).
        </p>
      </div>

      {/* Correlation Matrix Cards */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Correlation with Log₁₀(Views) &mdash; Key Catalog Drivers:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {renderCorrBadge(
            correlations.ctr.r,
            correlations.ctr.rho,
            'Click-Through Rate (CTR)',
            correlations.ctr.r > 0.3
              ? 'Strong thumbnail driver. High CTR directly scales views.'
              : 'Moderate driver across catalog.'
          )}
          {renderCorrBadge(
            correlations.retention.r,
            correlations.retention.rho,
            'Audience Retention (AVD %)',
            correlations.retention.r > 0.3
              ? 'Crucial satisfaction signal. High retention triggers algorithm.'
              : 'Balanced retention signal.'
          )}
          {renderCorrBadge(
            correlations.subscribers.r,
            correlations.subscribers.rho,
            'Subscribers / 1K Views',
            'Conversion velocity metric for channel growth.'
          )}
          {renderCorrBadge(
            correlations.repeatOrder.r,
            correlations.repeatOrder.rho,
            'Repeat Appearance (#)',
            correlations.repeatOrder.r < -0.1
              ? 'Negative drag: later covers of same artist draw fewer views.'
              : 'Repeat appearance trend.'
          )}
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-slate-700 text-white border-slate-600'
                : 'bg-slate-950/60 text-slate-400 hover:text-white border-slate-800'
            }`}
          >
            All Videos ({categoryCounts['ALL']})
          </button>

          <button
            onClick={() => setSelectedCategory('Breakout Hit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              selectedCategory === 'Breakout Hit'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-950/60 text-emerald-400/80 hover:text-emerald-300 border-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Breakout Hit ({categoryCounts['Breakout Hit']})
          </button>

          <button
            onClick={() => setSelectedCategory('Subscriber Fatigue (Low CTR)')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              selectedCategory === 'Subscriber Fatigue (Low CTR)'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-950/60 text-amber-400/80 hover:text-amber-300 border-slate-800'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            Fatigue (Low CTR) ({categoryCounts['Subscriber Fatigue (Low CTR)']})
          </button>

          <button
            onClick={() => setSelectedCategory('AlgorithmCapped (Low Impressions)')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              selectedCategory === 'AlgorithmCapped (Low Impressions)'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-slate-950/60 text-purple-400/80 hover:text-purple-300 border-slate-800'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            Algorithm Capped ({categoryCounts['AlgorithmCapped (Low Impressions)']})
          </button>

          <button
            onClick={() => setSelectedCategory('Retention Drop (Low AVD)')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              selectedCategory === 'Retention Drop (Low AVD)'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-950/60 text-rose-400/80 hover:text-rose-300 border-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Retention Drop ({categoryCounts['Retention Drop (Low AVD)']})
          </button>

          <button
            onClick={() => setSelectedCategory('Baseline Performer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              selectedCategory === 'Baseline Performer'
                ? 'bg-slate-800 text-slate-200 border-slate-700'
                : 'bg-slate-950/60 text-slate-400 hover:text-white border-slate-800'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Baseline ({categoryCounts['Baseline Performer']})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-60">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
          />
        </div>
      </div>

      {/* Diagnostics Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Video Details</th>
              <th className="py-3 px-3">Publish Date</th>
              <th className="py-3 px-3">Actual Views</th>
              <th className="py-3 px-3">Age Multiplier</th>
              <th className="py-3 px-3">CTR % (vs Median {medianCtr.toFixed(1)}%)</th>
              <th className="py-3 px-3">Retention % (vs {medianRetention.toFixed(1)}%)</th>
              <th className="py-3 px-4 text-right">Diagnosed Funnel Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
            {filteredVideos.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No videos found matching the selected filter.
                </td>
              </tr>
            ) : (
              filteredVideos.map((v) => {
                const mult = v.ageModelMultiplier;
                const ctrDelta = v.impressionsCtrPct - medianCtr;
                const retDelta = v.averagePercentageViewed - medianRetention;

                return (
                  <tr key={v.videoId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 max-w-xs">
                      <p className="font-semibold text-white truncate" title={v.videoTitle}>
                        {v.videoTitle}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        {v.parsedArtist && (
                          <span className="text-amber-400/90 font-medium">{v.parsedArtist}</span>
                        )}
                        {v.artistAppearanceNumber && (
                          <span>(Cover #{v.artistAppearanceNumber})</span>
                        )}
                        {v.macroGenre && <span>• {v.macroGenre}</span>}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                      {v.publishDate}
                      <span className="block text-[10px] text-slate-500">
                        {v.daysSinceUpload}d ago
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono font-semibold text-white">
                      {formatViews(v.views)}
                      <span className="block text-[10px] text-slate-400 font-sans">
                        Exp: {formatViews(v.expectedViewsAgeModel)}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`font-black text-xs ${
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

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-200">
                          {v.impressionsCtrPct.toFixed(1)}%
                        </span>
                        <span
                          className={`text-[10px] font-mono ${
                            ctrDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          ({ctrDelta >= 0 ? `+${ctrDelta.toFixed(1)}` : ctrDelta.toFixed(1)}%)
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-200">
                          {v.averagePercentageViewed.toFixed(1)}%
                        </span>
                        <span
                          className={`text-[10px] font-mono ${
                            retDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          ({retDelta >= 0 ? `+${retDelta.toFixed(1)}` : retDelta.toFixed(1)}%)
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-semibold border ${
                          v.funnelBottleneck === 'Breakout Hit'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : v.funnelBottleneck === 'Subscriber Fatigue (Low CTR)'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : v.funnelBottleneck === 'AlgorithmCapped (Low Impressions)'
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            : v.funnelBottleneck === 'Retention Drop (Low AVD)'
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {v.funnelBottleneck}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
