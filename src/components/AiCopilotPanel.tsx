'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  Cpu,
  RefreshCw,
  Copy,
  Check,
  Send,
  Zap,
  Tag,
  Lightbulb,
} from 'lucide-react';
import {
  EnrichedVideoAnalytics,
  RegressionModelSummary,
  RepeatArtistScorecard,
} from '@/lib/youtube_studio_stats_engine';

interface AiCopilotPanelProps {
  videos: EnrichedVideoAnalytics[];
  ageModel: RegressionModelSummary | null;
  repeatScorecards: RepeatArtistScorecard[];
  decaySummary: any[];
  onBatchEnrichTitles?: (classified: any[]) => void;
}

export const AiCopilotPanel: React.FC<AiCopilotPanelProps> = ({
  videos,
  ageModel,
  repeatScorecards,
  decaySummary,
  onBatchEnrichTitles,
}) => {
  const [provider, setProvider] = useState<'heuristic' | 'ollama'>('heuristic');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3.2');
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeProviderUsed, setActiveProviderUsed] = useState<string | null>(null);

  // Generate Executive Strategy Report
  const handleGenerateReport = async () => {
    setIsLoadingReport(true);
    setReport(null);

    try {
      const topArtists = repeatScorecards.slice(0, 5);
      const bottomArtists = [...repeatScorecards]
        .reverse()
        .slice(0, 5);

      const catalogSummary = {
        totalVideos: videos.length,
        totalViews: videos.reduce((acc, v) => acc + v.views, 0),
        ageModel,
        topArtists,
        bottomArtists,
        sequentialDecay: decaySummary,
        medianCtr: 6.8,
        medianRetention: 65.0,
      };

      const res = await fetch('/api/ai-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'insights',
          catalogSummary,
          provider,
          ollamaUrl,
          model: ollamaModel,
        }),
      });

      const data = await res.json();
      if (data.report) {
        setReport(data.report);
        setActiveProviderUsed(data.provider);
      } else {
        setReport('Unable to generate strategy report. Check connection or provider settings.');
      }
    } catch (err: any) {
      setReport(`Error generating report: ${err.message}`);
    } finally {
      setIsLoadingReport(false);
    }
  };

  // Run Batch Title & Genre Auto-Enrichment
  const handleBatchClassify = async () => {
    setIsClassifying(true);
    try {
      const unclassified = videos.filter((v) => !v.macroGenre || !v.parsedArtist).slice(0, 20);
      const targets = (unclassified.length > 0 ? unclassified : videos).slice(0, 15).map((v) => ({
        videoId: v.videoId,
        videoTitle: v.videoTitle,
      }));

      const res = await fetch('/api/ai-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'classify',
          titles: targets,
          provider,
          ollamaUrl,
          model: ollamaModel,
        }),
      });

      const data = await res.json();
      if (data.results && onBatchEnrichTitles) {
        onBatchEnrichTitles(data.results);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsClassifying(false);
    }
  };

  const copyToClipboard = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header & Settings */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30">
              <Bot className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Executive AI Copilot & Hybrid Title/Genre Classifier
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Data-grounded algorithmic intelligence: synthesizes your OLS regression multipliers, repeat decay curves, and genre velocity into executive takeaways.
          </p>
        </div>

        {/* Model Selector Toggle */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg p-1 bg-slate-950/80 border border-slate-800 text-xs">
            <button
              onClick={() => setProvider('heuristic')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                provider === 'heuristic'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Instant Statistical Engine
            </button>
            <button
              onClick={() => setProvider('ollama')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                provider === 'ollama'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Local Ollama (LLM)
            </button>
          </div>
        </div>
      </div>

      {/* Ollama Config Bar (if selected) */}
      {provider === 'ollama' && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
          <span className="text-purple-400 font-semibold flex items-center gap-1">
            <Cpu className="w-4 h-4" /> Ollama Endpoint:
          </span>
          <input
            type="text"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white w-52"
          />
          <span className="text-slate-400">Model:</span>
          <input
            type="text"
            value={ollamaModel}
            onChange={(e) => setOllamaModel(e.target.value)}
            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white w-32"
          />
          <span className="text-slate-500 text-[11px]">
            (Defaults to localhost:11434 with llama3.2 or qwen2.5)
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleGenerateReport}
          disabled={isLoadingReport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
        >
          {isLoadingReport ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-amber-300" />
          )}
          {isLoadingReport ? 'Analyzing Catalog Math...' : 'Generate Executive Strategy Report'}
        </button>

        <button
          onClick={handleBatchClassify}
          disabled={isClassifying}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all disabled:opacity-50"
        >
          {isClassifying ? (
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
          ) : (
            <Tag className="w-4 h-4 text-indigo-400" />
          )}
          {isClassifying ? 'Classifying Titles...' : 'Batch Auto-Classify Genres & Decades'}
        </button>
      </div>

      {/* Report Display Box */}
      {report && (
        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 relative group">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-400" /> Generated Intelligence
              {activeProviderUsed && (
                <span className="font-mono text-[10px] text-slate-500 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  via {activeProviderUsed}
                </span>
              )}
            </span>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Markdown
                </>
              )}
            </button>
          </div>

          <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans space-y-2">
            {report}
          </div>
        </div>
      )}
    </div>
  );
};
