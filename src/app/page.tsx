'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Layers,
  Activity,
  Bot,
  BookOpen,
  Youtube,
  Upload,
  RefreshCw,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useCatalogAnalytics } from '@/hooks/useCatalogAnalytics';
import { CsvDropzone } from '@/components/CsvDropzone';
import { OverviewKpiCards } from '@/components/OverviewKpiCards';
import { RegressionScatterPlot } from '@/components/RegressionScatterPlot';
import { SequentialDecayChart } from '@/components/SequentialDecayChart';
import { RepeatArtistScorecardTable } from '@/components/RepeatArtistScorecardTable';
import { FunnelDiagnosticsTable } from '@/components/FunnelDiagnosticsTable';
import { AiCopilotPanel } from '@/components/AiCopilotPanel';

export default function DashboardPage() {
  const {
    rawVideos,
    analytics,
    filteredVideos,
    filters,
    setFilters,
    dataSource,
    fileName,
    allGenres,
    loadSampleData,
    loadCustomVideos,
    batchUpdateVideos,
    clearData,
  } = useCatalogAnalytics();

  const [activeTab, setActiveTab] = useState<
    'regression' | 'repeat_artists' | 'sequential_decay' | 'funnel' | 'copilot' | 'methodology'
  >('regression');

  const [isDropzoneExpanded, setIsDropzoneExpanded] = useState(false);

  // Handle batch title / genre enrichment from AI Copilot
  const handleBatchEnrich = (classified: any[]) => {
    const updates = classified.map((c) => ({
      videoId: c.videoId,
      updates: {
        parsedSongTitle: c.parsedSongTitle,
        parsedArtist: c.parsedArtist,
        macroGenre: c.macroGenre,
        subgenre: c.subgenre,
      },
    }));
    batchUpdateVideos(updates);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-500 shadow-md shadow-red-600/10">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-tight">
                  YouTube Studio Statistical Analyzer
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Antigravity Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Log₁₀ OLS Multiple Regression • Diminishing Returns Curves • Funnel Diagnostics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDropzoneExpanded(!isDropzoneExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all"
            >
              <Upload className="w-3.5 h-3.5 text-red-400" />
              <span>{isDropzoneExpanded ? 'Hide Dropzone' : 'Upload CSV'}</span>
            </button>

            <button
              onClick={loadSampleData}
              title="Reset to 60-video cover band sample dataset"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Demo Dataset</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* CSV Dropzone (Collapsible or always visible when expanded) */}
        {(isDropzoneExpanded || rawVideos.length === 0) && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <CsvDropzone
              onDataLoaded={(vids, name) => {
                loadCustomVideos(vids, name);
                setIsDropzoneExpanded(false);
              }}
              onLoadSampleData={() => {
                loadSampleData();
                setIsDropzoneExpanded(false);
              }}
              dataSource={dataSource}
              fileName={fileName}
              videoCount={rawVideos.length}
            />
          </div>
        )}

        {/* Overview KPI Cards */}
        <OverviewKpiCards
          videos={analytics.videos}
          ageModel={analytics.ageRegressionModel}
          repeatScorecards={analytics.repeatArtistScorecards}
        />

        {/* Global Genre Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Genre:
            </span>
            <button
              onClick={() => setFilters((prev) => ({ ...prev, selectedGenre: 'ALL' }))}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                filters.selectedGenre === 'ALL'
                  ? 'bg-red-500/20 text-red-300 border-red-500/40 font-semibold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white border-slate-800'
              }`}
            >
              All Genres ({rawVideos.length})
            </button>
            {allGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => setFilters((prev) => ({ ...prev, selectedGenre: genre }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  filters.selectedGenre === genre
                    ? 'bg-red-500/20 text-red-300 border-red-500/40 font-semibold'
                    : 'bg-slate-950/60 text-slate-400 hover:text-white border-slate-800'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
              }
              placeholder="Search catalog..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500/50"
            />
          </div>
        </div>

        {/* Tab Navigation Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('regression')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'regression'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Age vs Views Regression</span>
          </button>

          <button
            onClick={() => setActiveTab('repeat_artists')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'repeat_artists'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Repeat Artist Scorecards ({analytics.repeatArtistScorecards.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sequential_decay')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'sequential_decay'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Sequential Decay (#1 &rarr; #5+)</span>
          </button>

          <button
            onClick={() => setActiveTab('funnel')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'funnel'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Funnel Diagnostics</span>
          </button>

          <button
            onClick={() => setActiveTab('copilot')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'copilot'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Bot className="w-4 h-4 text-amber-300" />
            <span>Executive AI Copilot</span>
          </button>

          <button
            onClick={() => setActiveTab('methodology')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'methodology'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Statistical Math Guide</span>
          </button>
        </div>

        {/* Tab View Content */}
        <div className="min-h-[500px]">
          {activeTab === 'regression' && (
            <RegressionScatterPlot
              videos={filteredVideos}
              ageModel={analytics.ageRegressionModel}
            />
          )}

          {activeTab === 'repeat_artists' && (
            <RepeatArtistScorecardTable
              scorecards={analytics.repeatArtistScorecards}
            />
          )}

          {activeTab === 'sequential_decay' && (
            <SequentialDecayChart
              decaySummary={analytics.sequentialCoverDecaySummary}
            />
          )}

          {activeTab === 'funnel' && (
            <FunnelDiagnosticsTable videos={filteredVideos} />
          )}

          {activeTab === 'copilot' && (
            <AiCopilotPanel
              videos={analytics.videos}
              ageModel={analytics.ageRegressionModel}
              repeatScorecards={analytics.repeatArtistScorecards}
              decaySummary={analytics.sequentialCoverDecaySummary}
              onBatchEnrichTitles={handleBatchEnrich}
            />
          )}

          {activeTab === 'methodology' && (
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  The 5 Statistical Building Blocks in youtube_studio_stats_engine.ts
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  How the deterministic math behind this analyzer works and why standard YouTube averages are misleading.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Concept 1 */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                    1. Log₁₀ Transformation
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Raw YouTube views follow a <strong>power law</strong>. A few viral hits have 15M–77M views while most sit between 200K and 1M. Taking <code className="font-mono text-amber-300">Math.log10(views)</code> converts orders of magnitude into a linear scale (100K = 5.0, 1M = 6.0, 10M = 7.0). Every +0.30 in log space represents exactly <strong>2.0x</strong> as many views.
                  </p>
                </div>

                {/* Concept 2 */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                    2. Pearson (r) vs. Spearman Rank (ρ) Correlation
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong>Pearson r</strong> measures linear alignment, while <strong>Spearman ρ</strong> converts numbers to ranks (1st, 2nd, 3rd) first so that viral outliers cannot distort the relationship. It reveals whether CTR or retention actually drives the YouTube algorithm.
                  </p>
                </div>

                {/* Concept 3 */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    3. Ordinary Least Squares (OLS) Multiple Regression
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    A video uploaded 5 years ago had 5 years to accumulate views, while a video uploaded 2 months ago has just begun. OLS computes the expected view curve ŷ = β₀ + β₁(Days) so we can benchmark each video against its exact age. R² measures how much view variance is explained by age.
                  </p>
                </div>

                {/* Concept 4 */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    4. Log Residuals & Multipliers (10^residual)
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    The Residual is Actual log₁₀(Views) − Expected log₁₀(Views). Because subtraction in log space is division in normal space, 10^(residual) yields the exact ratio: <strong>2.50x</strong> means +150% above expectations, while <strong>0.50x</strong> means −50%.
                  </p>
                </div>

                {/* Concept 5 */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 md:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                    5. Geometric Mean of Multipliers
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Never calculate an arithmetic mean of raw multipliers! A 4.0x video and a 0.25x video should cancel out to 1.0x, whereas an arithmetic mean would falsely claim (4.0 + 0.25)/2 = 2.12x. Averaging log residuals and taking 10^(mean) yields the <strong>Geometric Mean</strong>, treating overperformance and underperformance symmetrically.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/50 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>YouTube Studio Statistical Analyzer &bull; Built with Google Antigravity IDE</span>
          <span className="text-slate-400">
            Powered by Next.js, TypeScript, Tailwind CSS, PapaParse, Recharts &amp; Vercel AI SDK
          </span>
        </div>
      </footer>
    </div>
  );
}
