'use client';

import { useState } from 'react';
import { EnrichedVideoAnalytics, median, mean } from '@/lib/youtube_studio_stats_engine';

const dimensions = {
  topic: 'Topic / subject',
  franchise: 'Franchise / series',
  contentFormat: 'Content format',
  contentCategory: 'Category',
} as const;

export function ContentExplorer({ videos }: { videos: EnrichedVideoAnalytics[] }) {
  const [dimension, setDimension] = useState<keyof typeof dimensions>('topic');
  const groups = new Map<string, EnrichedVideoAnalytics[]>();
  for (const video of videos) {
    const label = video[dimension]?.trim() || 'Unclassified';
    groups.set(label, [...(groups.get(label) ?? []), video]);
  }
  const rows = Array.from(groups, ([label, members]) => ({
    label,
    count: members.length,
    views: members.reduce((total, video) => total + video.views, 0),
    medianViews: median(members.map((video) => video.views)),
    multiplier: 10 ** mean(members.map((video) => video.ageModelLogResidual)),
  })).sort((first, second) => second.views - first.views);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
      <h2 className="text-xl font-bold">Content performance</h2>
      <p className="text-sm text-slate-400">
        Compare films, shows, franchises, artists, recurring subjects, or comedy formats.
        Add optional Topic, Franchise, Content format, and Category columns to your CSV.
        Untagged videos remain visible as Unclassified; titles are not guessed into subjects.
      </p>
      <label className="block text-sm">
        Group by
        <select className="ml-3 rounded-lg bg-slate-950 border border-slate-700 p-2" value={dimension}
          onChange={(event) => setDimension(event.target.value as keyof typeof dimensions)}>
          {Object.entries(dimensions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <caption className="sr-only">Performance grouped by {dimensions[dimension]}</caption>
          <thead className="text-slate-400"><tr>
            {['Group', 'Videos', 'Total views', 'Median views', 'Age-adjusted performance'].map((heading) =>
              <th scope="col" key={heading} className="p-3">{heading}</th>)}
          </tr></thead>
          <tbody>{rows.length ? rows.map((row) => <tr key={row.label} className="border-t border-slate-800">
            <th scope="row" className="p-3">{row.label}</th>
            <td className="p-3">{row.count}{row.count < 3 ? ' (small sample)' : ''}</td>
            <td className="p-3">{row.views.toLocaleString()}</td>
            <td className="p-3">{row.medianViews.toLocaleString()}</td>
            <td className="p-3">{row.multiplier.toFixed(2)}×</td>
          </tr>) : <tr><td colSpan={5} className="p-6 text-slate-400">No videos match. Clear the search or genre filter, or upload a CSV.</td></tr>}</tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Multipliers use the full catalog age baseline, not a causal estimate of topic appeal.
        Release timing, format, duration, and audience differences can confound comparisons.
        Small groups are exploratory, not reliable predictions.
      </p>
    </section>
  );
}
