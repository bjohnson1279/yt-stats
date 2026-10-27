'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  EnrichedVideoAnalytics,
  RegressionModelSummary,
} from '@/lib/youtube_studio_stats_engine';
import { Sparkles, TrendingUp, Info, HelpCircle } from 'lucide-react';

interface RegressionScatterPlotProps {
  videos: EnrichedVideoAnalytics[];
  ageModel: RegressionModelSummary | null;
}

export const RegressionScatterPlot: React.FC<RegressionScatterPlotProps> = ({
  videos,
  ageModel,
}) => {
  const [scaleMode, setScaleMode] = useState<'log10' | 'linear'>('log10');
  const [filterHighlight, setFilterHighlight] = useState<'ALL' | 'OVER' | 'UNDER' | 'BREAKOUT'>('ALL');

  // Format numbers for display
  const formatViews = (val: number): string => {
    if (val >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1) + 'B';
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
    if (val >= 1_000) return (val / 1_000).toFixed(0) + 'K';
    return val.toLocaleString();
  };

  // Prepare scatter data and trendline curve points
  const { chartData, trendlineData, minDays, maxDays } = useMemo(() => {
    if (!videos || videos.length === 0) {
      return { chartData: [], trendlineData: [], minDays: 0, maxDays: 3000 };
    }

    const daysList = videos.map((v) => v.daysSinceUpload);
    const minD = Math.max(1, Math.min(...daysList));
    const maxD = Math.max(...daysList, 30);

    // Prepare individual video points
    const scatterPoints = videos.map((v) => {
      let fillColor = '#94a3b8'; // Slate baseline (0.80x - 1.25x)
      if (v.ageModelMultiplier >= 1.25) {
        fillColor = '#10b981'; // Emerald overperformer
      } else if (v.ageModelMultiplier < 0.8) {
        fillColor = '#f43f5e'; // Rose underperformer
      }

      const isBreakout = v.funnelBottleneck === 'Breakout Hit';
      const isOver = v.ageModelMultiplier >= 1.25;
      const isUnder = v.ageModelMultiplier < 0.8;

      let opacity = 0.85;
      if (filterHighlight === 'OVER' && !isOver) opacity = 0.15;
      if (filterHighlight === 'UNDER' && !isUnder) opacity = 0.15;
      if (filterHighlight === 'BREAKOUT' && !isBreakout) opacity = 0.15;

      return {
        ...v,
        x: v.daysSinceUpload,
        y: scaleMode === 'log10' ? v.log10Views : v.views,
        expectedY:
          scaleMode === 'log10'
            ? Math.log10(Math.max(1, v.expectedViewsAgeModel))
            : v.expectedViewsAgeModel,
        fillColor,
        opacity,
      };
    });

    // Generate trendline points across domain
    const trendline: Array<{ x: number; trendY: number }> = [];
    if (ageModel) {
      const step = Math.max(10, Math.floor((maxD - minD) / 40));
      for (let d = minD; d <= maxD; d += step) {
        const predLog = ageModel.intercept + (ageModel.slopes.daysSinceUpload ?? 0) * d;
        const trendVal = scaleMode === 'log10' ? predLog : Math.round(10 ** predLog);
        trendline.push({ x: d, trendY: trendVal });
      }
      // Add exact maxD endpoint
      const endLog = ageModel.intercept + (ageModel.slopes.daysSinceUpload ?? 0) * maxD;
      trendline.push({
        x: maxD,
        trendY: scaleMode === 'log10' ? endLog : Math.round(10 ** endLog),
      });
    }

    return {
      chartData: scatterPoints,
      trendlineData: trendline,
      minDays: minD,
      maxDays: maxD,
    };
  }, [videos, ageModel, scaleMode, filterHighlight]);

  // Custom Rich Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload as (typeof chartData)[0];
    if (!data || !data.videoTitle) return null;

    const mult = data.ageModelMultiplier;
    const multColor =
      mult >= 1.25 ? 'text-emerald-400' : mult < 0.8 ? 'text-rose-400' : 'text-slate-300';

    return (
      <div className="bg-slate-950/95 border border-slate-700/80 rounded-xl p-4 shadow-2xl backdrop-blur-md max-w-sm text-xs space-y-2 z-50">
        <div className="border-b border-slate-800 pb-2">
          <p className="font-semibold text-white text-sm line-clamp-2 leading-snug">
            {data.videoTitle}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
            <span>Published: {data.publishDate}</span>
            <span>•</span>
            <span>{data.daysSinceUpload} days ago</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">
              Actual Views
            </span>
            <span className="font-bold text-white text-sm">
              {formatViews(data.views)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">
              Expected Views
            </span>
            <span className="font-bold text-slate-300 text-sm">
              {formatViews(data.expectedViewsAgeModel)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-slate-400 font-medium">Age Multiplier:</span>
          <span className={`font-black text-sm ${multColor}`}>
            {mult.toFixed(2)}x{' '}
            <span className="text-[11px] font-normal">
              ({mult >= 1 ? `+${Math.round((mult - 1) * 100)}%` : `-${Math.round((1 - mult) * 100)}%`})
            </span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
          <div className="flex justify-between border-r border-slate-800 pr-2">
            <span className="text-slate-400">CTR:</span>
            <span className="font-semibold text-slate-200">{data.impressionsCtrPct.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between pl-1">
            <span className="text-slate-400">Retention:</span>
            <span className="font-semibold text-slate-200">
              {data.averagePercentageViewed.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="pt-1">
          <span
            className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-semibold border ${
              data.funnelBottleneck === 'Breakout Hit'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : data.funnelBottleneck === 'Subscriber Fatigue (Low CTR)'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : data.funnelBottleneck === 'AlgorithmCapped (Low Impressions)'
                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                : data.funnelBottleneck === 'Retention Drop (Low AVD)'
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            Diagnostics: {data.funnelBottleneck}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Age vs. Views Regression Model (Expected Views Curve)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            OLS regression curve predicts expected views for any video age. Points above the curve outperform expectations (10^residual &gt; 1.0x).
          </p>
        </div>

        {/* Action Toggles */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Scale Mode Toggle */}
          <div className="inline-flex rounded-lg p-1 bg-slate-950/80 border border-slate-800 text-xs">
            <button
              onClick={() => setScaleMode('log10')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                scaleMode === 'log10'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Log₁₀ Scale (Linear Model)
            </button>
            <button
              onClick={() => setScaleMode('linear')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                scaleMode === 'linear'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Linear Views Scale
            </button>
          </div>

          {/* Filter Highlight */}
          <div className="inline-flex rounded-lg p-1 bg-slate-950/80 border border-slate-800 text-xs">
            <button
              onClick={() => setFilterHighlight('ALL')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                filterHighlight === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterHighlight('OVER')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                filterHighlight === 'OVER'
                  ? 'bg-emerald-600/30 text-emerald-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Over (≥1.25x)
            </button>
            <button
              onClick={() => setFilterHighlight('UNDER')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                filterHighlight === 'UNDER'
                  ? 'bg-rose-600/30 text-rose-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Under (&lt;0.8x)
            </button>
            <button
              onClick={() => setFilterHighlight('BREAKOUT')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                filterHighlight === 'BREAKOUT'
                  ? 'bg-amber-600/30 text-amber-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Breakouts
            </button>
          </div>
        </div>
      </div>

      {/* Legend & Stats bar */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 gap-3">
        <div className="flex items-center flex-wrap gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span>Overperformer (&ge; 1.25x)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-400 inline-block" />
            <span>Baseline (0.80x &ndash; 1.25x)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
            <span>Underperformer (&lt; 0.80x)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-blue-400 inline-block" />
            <span>OLS Expected Views Curve</span>
          </div>
        </div>

        {ageModel && (
          <div className="font-mono text-[11px] text-slate-300 flex items-center gap-2">
            <span>R² = {ageModel.rSquared.toFixed(3)}</span>
            <span>•</span>
            <span>
              Slope: +{(ageModel.slopes.daysSinceUpload * 100).toFixed(3)} log / 100d
            </span>
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-[460px] pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            margin={{ top: 20, right: 30, bottom: 30, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 'auto']}
              name="Days Since Upload"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              unit=" d"
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={scaleMode === 'log10' ? [4.0, 'auto'] : [0, 'auto']}
              name="Views"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(val) =>
                scaleMode === 'log10' ? `10^${val.toFixed(1)} (${formatViews(10 ** val)})` : formatViews(val)
              }
            />
            <ZAxis range={[70, 70]} />
            <Tooltip content={<CustomTooltip />} />

            {/* OLS Trendline */}
            <Line
              data={trendlineData}
              dataKey="trendY"
              type="monotone"
              stroke="#38bdf8"
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              isAnimationActive={true}
              name="OLS Expected Curve"
            />

            {/* Video Data Points */}
            <Scatter
              data={chartData}
              name="Videos"
              isAnimationActive={true}
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill={payload.fillColor}
                    stroke="#0f172a"
                    strokeWidth={1.5}
                    fillOpacity={payload.opacity ?? 0.85}
                    className="cursor-pointer transition-all hover:scale-150 hover:stroke-white"
                  />
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
