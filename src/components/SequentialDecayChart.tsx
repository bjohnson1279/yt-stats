'use client';

import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Layers, AlertTriangle, TrendingDown, CheckCircle2 } from 'lucide-react';

interface SequentialDecaySummaryItem {
  appearanceBucket: string;
  videoCount: number;
  medianViews: number;
  meanCtrPct: number;
  geometricMeanAgeMultiplier: number;
  winRatePct: number;
}

interface SequentialDecayChartProps {
  decaySummary: SequentialDecaySummaryItem[];
}

export const SequentialDecayChart: React.FC<SequentialDecayChartProps> = ({
  decaySummary,
}) => {
  if (!decaySummary || decaySummary.length === 0) return null;

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = decaySummary.find((d) => d.appearanceBucket === label);
    if (!item) return null;

    const mult = item.geometricMeanAgeMultiplier;
    return (
      <div className="bg-slate-950/95 border border-slate-700/80 rounded-xl p-4 shadow-2xl backdrop-blur-md text-xs space-y-2 z-50 min-w-[220px]">
        <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
          <span className="font-bold text-white text-sm">{item.appearanceBucket}</span>
          <span className="text-[11px] text-slate-400">{item.videoCount} Videos</span>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Geometric Multiplier:</span>
            <span
              className={`font-black text-sm ${
                mult >= 1.0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {mult.toFixed(2)}x
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Average CTR:</span>
            <span className="font-semibold text-amber-300">
              {item.meanCtrPct.toFixed(2)}%
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Model Win Rate:</span>
            <span className="font-semibold text-purple-300">
              {item.winRatePct.toFixed(1)}%
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Median Views:</span>
            <span className="font-mono text-slate-200">
              {item.medianViews.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Check where drop occurs (e.g. between Cover #2 and #4)
  const firstDropIndex = decaySummary.findIndex(
    (d, i) => i > 0 && d.geometricMeanAgeMultiplier < 0.95
  );

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Layers className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Sequential Cover Decay Curve (Cover #1 &rarr; #5+)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visualizes diminishing returns as an artist is repeated across the channel. Tracks multiplier degradation against subscriber CTR fatigue.
          </p>
        </div>

        {firstDropIndex > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Diminishing returns accelerate at{' '}
              <strong className="underline decoration-amber-400/60 font-semibold">
                {decaySummary[firstDropIndex].appearanceBucket}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Decay Canvas */}
      <div className="w-full h-[380px] pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={decaySummary}
            margin={{ top: 20, right: 30, bottom: 20, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="appearanceBucket"
              stroke="#64748b"
              tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 600 }}
            />
            {/* Left Axis: Multiplier (Bar) */}
            <YAxis
              yAxisId="left"
              stroke="#64748b"
              domain={[0, 'auto']}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(val) => `${val.toFixed(1)}x`}
              name="Multiplier"
            />
            {/* Right Axis: CTR % (Line) */}
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#f59e0b"
              domain={[0, 'auto']}
              tick={{ fill: '#f59e0b', fontSize: 11 }}
              tickFormatter={(val) => `${val.toFixed(1)}%`}
              name="CTR %"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 10, fontSize: 12 }}
              formatter={(value) => <span className="text-slate-300">{value}</span>}
            />

            {/* Reference Line at 1.0x Baseline Expectation */}
            <ReferenceLine
              yAxisId="left"
              y={1.0}
              stroke="#38bdf8"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: '1.0x Baseline Expectation',
                fill: '#38bdf8',
                fontSize: 11,
                position: 'top',
              }}
            />

            {/* Bar: Geometric Mean Multiplier */}
            <Bar
              yAxisId="left"
              dataKey="geometricMeanAgeMultiplier"
              name="Geometric Mean Multiplier"
              fill="#8b5cf6"
              radius={[6, 6, 0, 0]}
              barSize={40}
            />

            {/* Line: Mean CTR % */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="meanCtrPct"
              name="Mean CTR (%)"
              stroke="#f59e0b"
              strokeWidth={3}
              dot={{ r: 5, fill: '#f59e0b' }}
              activeDot={{ r: 7 }}
            />

            {/* Line: Win Rate % */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="winRatePct"
              name="Model Win Rate (%)"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 4, fill: '#10b981' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary insights grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
        {decaySummary.map((b) => (
          <div
            key={b.appearanceBucket}
            className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center"
          >
            <span className="text-[11px] font-bold text-slate-300 block">
              {b.appearanceBucket}
            </span>
            <span
              className={`text-lg font-black block mt-0.5 ${
                b.geometricMeanAgeMultiplier >= 1.0
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {b.geometricMeanAgeMultiplier.toFixed(2)}x
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              CTR: {b.meanCtrPct.toFixed(1)}% • Win: {b.winRatePct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
