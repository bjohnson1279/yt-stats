'use client';

import React from 'react';
import {
  TrendingUp,
  BarChart3,
  Percent,
  PlayCircle,
  Users,
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  EnrichedVideoAnalytics,
  RegressionModelSummary,
  RepeatArtistScorecard,
  median,
  mean,
} from '@/lib/youtube_studio_stats_engine';

interface OverviewKpiCardsProps {
  videos: EnrichedVideoAnalytics[];
  ageModel: RegressionModelSummary | null;
  repeatScorecards: RepeatArtistScorecard[];
}

export const OverviewKpiCards: React.FC<OverviewKpiCardsProps> = ({
  videos,
  ageModel,
  repeatScorecards,
}) => {
  if (!videos || videos.length === 0) return null;

  const totalViews = videos.reduce((acc, v) => acc + v.views, 0);
  const totalSubscribers = videos.reduce((acc, v) => acc + v.subscribersNet, 0);

  const medianViews = median(videos.map((v) => v.views));
  const medianCtr = median(videos.map((v) => v.impressionsCtrPct));
  const medianRetention = median(videos.map((v) => v.averagePercentageViewed));
  const medianAgeMultiplier = median(videos.map((v) => v.ageModelMultiplier));

  // Geometric mean multiplier of catalog
  const geoMeanCatalog =
    10 ** mean(videos.map((v) => v.ageModelLogResidual));

  // Top artist by multiplier
  const topArtist = repeatScorecards.length > 0 ? repeatScorecards[0] : null;

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {/* Card 1: Catalog Volume */}
      <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Catalog Volume</span>
          <span className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <PlayCircle className="w-4 h-4" />
          </span>
        </div>
        <div className="text-2xl font-black text-white tracking-tight">
          {formatNumber(totalViews)}
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400">{videos.length} Videos analyzed</span>
          <span className="text-emerald-400 font-medium">
            +{formatNumber(totalSubscribers)} Subs
          </span>
        </div>
      </div>

      {/* Card 2: Age Regression OLS Model (R²) */}
      <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Age Model Fit (R²)</span>
          <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <BarChart3 className="w-4 h-4" />
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-white tracking-tight">
            {ageModel ? (ageModel.rSquared * 100).toFixed(1) + '%' : 'N/A'}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            R² = {ageModel?.rSquared.toFixed(3) ?? '0.000'}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400">View variance by age</span>
          <span className="text-blue-400 font-mono text-[11px]">
            {ageModel?.slopes.daysSinceUpload
              ? `+${(ageModel.slopes.daysSinceUpload * 100).toFixed(2)} log / 100d`
              : 'OLS slope'}
          </span>
        </div>
      </div>

      {/* Card 3: Performance Multiplier */}
      <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Median Multiplier</span>
          <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-4 h-4" />
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-white tracking-tight">
            {medianAgeMultiplier.toFixed(2)}x
          </span>
          <span
            className={`text-xs font-semibold flex items-center ${
              geoMeanCatalog >= 1.0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {geoMeanCatalog >= 1.0 ? (
              <ArrowUpRight className="w-3.5 h-3.5 inline mr-0.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 inline mr-0.5" />
            )}
            Geom: {geoMeanCatalog.toFixed(2)}x
          </span>
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400">Expected vs. Actual</span>
          <span className="text-slate-300">
            Median: {formatNumber(medianViews)} views
          </span>
        </div>
      </div>

      {/* Card 4: Channel Benchmarks (CTR & Retention) */}
      <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Channel Benchmarks</span>
          <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Percent className="w-4 h-4" />
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-xs text-slate-400 block">Median CTR</span>
            <span className="text-xl font-black text-white tracking-tight">
              {medianCtr.toFixed(1)}%
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Avg % Viewed</span>
            <span className="text-xl font-black text-purple-300 tracking-tight">
              {medianRetention.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400">Top Repeat Artist</span>
          <span className="text-amber-400 font-medium truncate max-w-[130px]" title={topArtist?.artist}>
            {topArtist ? `${topArtist.artist} (${topArtist.geometricMeanAgeMultiplier.toFixed(2)}x)` : 'None'}
          </span>
        </div>
      </div>
    </div>
  );
};
