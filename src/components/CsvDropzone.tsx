'use client';

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Sparkles, HelpCircle, RefreshCw } from 'lucide-react';
import { parseYouTubeStudioCsv } from '@/lib/youtube-csv-parser';
import { YouTubeStudioVideoRow } from '@/lib/youtube_studio_stats_engine';

interface CsvDropzoneProps {
  onDataLoaded: (videos: YouTubeStudioVideoRow[], fileName: string) => void;
  onLoadSampleData: () => void;
  dataSource: 'sample' | 'custom_csv';
  fileName: string | null;
  videoCount: number;
}

export const CsvDropzone: React.FC<CsvDropzoneProps> = ({
  onDataLoaded,
  onLoadSampleData,
  dataSource,
  fileName,
  videoCount,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setErrorMessage('Please upload a valid .csv export file (typically "Table data.csv" from YouTube Studio).');
      return;
    }

    setErrorMessage(null);
    setStatusMessage('Parsing CSV and extracting video metrics...');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const result = parseYouTubeStudioCsv(text);

        if (result.videos.length === 0) {
          setErrorMessage(
            'No valid video data rows could be parsed from this CSV. Ensure this is a YouTube Studio "Table data.csv" export.'
          );
          setStatusMessage(null);
          return;
        }

        onDataLoaded(result.videos, file.name);
        setStatusMessage(
          `Successfully parsed ${result.videos.length} videos. Skipped ${result.skippedSummaryRows} summary row(s).`
        );
      } catch (err: any) {
        setErrorMessage(`Parsing error: ${err.message || 'Failed to read file'}`);
        setStatusMessage(null);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Error reading the selected file.');
      setStatusMessage(null);
    };
    reader.readAsText(file);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Upload className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              YouTube Studio Data Ingestion
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Drop your raw <code className="text-red-400 font-mono text-xs px-1.5 py-0.5 bg-red-950/40 border border-red-900/40 rounded">Table data.csv</code> export. 100% parsed client-side in the browser.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-slate-400" />
            Export Guide
          </button>
          <button
            onClick={onLoadSampleData}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
              dataSource === 'sample'
                ? 'bg-red-500/15 text-red-300 border-red-500/30 shadow-sm shadow-red-500/10'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Load Sample Cover Band Data (60 Vids)
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="mb-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2 animate-in fade-in duration-200">
          <p className="font-semibold text-white flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> How to export from YouTube Studio:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
            <li>Open <span className="text-red-400 font-medium">YouTube Studio</span> &rarr; <span className="font-medium text-white">Analytics</span> &rarr; <span className="font-medium text-white">Content</span> tab.</li>
            <li>Click <span className="font-medium text-white">Advanced Mode</span> (top right).</li>
            <li>Set Date range to <span className="font-medium text-white">Lifetime</span> (or 365 Days).</li>
            <li>Click the <span className="font-medium text-white">Export</span> button (top right) &rarr; choose <span className="font-medium text-emerald-300">Comma-separated values (.csv)</span>.</li>
            <li>Extract the zip and drag <span className="font-mono text-red-400">Table data.csv</span> into the zone below!</li>
          </ol>
        </div>
      )}

      {/* Drop Zone Box */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 relative group ${
          isDragging
            ? 'border-red-500 bg-red-950/20 scale-[0.99]'
            : 'border-slate-700 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-950/60'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileInputChange}
          accept=".csv"
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-red-500/20 to-purple-500/20 border border-red-500/30 text-red-400 group-hover:scale-110 transition-transform">
            <FileText className="w-8 h-8" />
          </div>

          <div>
            <p className="text-base font-semibold text-white">
              Drag & drop your <span className="text-red-400">Table data.csv</span> here, or click to browse
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports standard YouTube Studio columns (Content, Video title, Duration, Views, CTR %, Retention, Impressions)
            </p>
          </div>

          {/* Current active status badge */}
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800/80 border border-slate-700 text-slate-300">
              {dataSource === 'sample' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Active: Demo Cover Band Dataset ({videoCount} videos)
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Active: {fileName || 'Uploaded CSV'} ({videoCount} videos)
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      {statusMessage && (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-3 py-2 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 flex items-center gap-2 text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
