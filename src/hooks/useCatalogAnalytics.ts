import { useState, useMemo, useCallback } from 'react';
import {
  analyzeYouTubeCatalog,
  YouTubeStudioVideoRow,
  EnrichedVideoAnalytics,
  RegressionModelSummary,
  RepeatArtistScorecard,
} from '@/lib/youtube_studio_stats_engine';
import { SAMPLE_COVER_VIDEOS } from '@/lib/sample-cover-band-data';

export interface CatalogFilterState {
  searchQuery: string;
  selectedGenre: string;
  selectedBottleneck: string;
  minViews: number;
}

export interface UseCatalogAnalyticsReturn {
  rawVideos: YouTubeStudioVideoRow[];
  analytics: {
    videos: EnrichedVideoAnalytics[];
    ageRegressionModel: RegressionModelSummary | null;
    combinedRegressionModel?: RegressionModelSummary;
    repeatArtistScorecards: RepeatArtistScorecard[];
    sequentialCoverDecaySummary: Array<{
      appearanceBucket: string;
      videoCount: number;
      medianViews: number;
      meanCtrPct: number;
      geometricMeanAgeMultiplier: number;
      winRatePct: number;
    }>;
  };
  filteredVideos: EnrichedVideoAnalytics[];
  filters: CatalogFilterState;
  setFilters: React.Dispatch<React.SetStateAction<CatalogFilterState>>;
  dataSource: 'sample' | 'custom_csv';
  fileName: string | null;
  allGenres: string[];
  allArtists: string[];
  loadSampleData: () => void;
  loadCustomVideos: (videos: YouTubeStudioVideoRow[], fileName?: string) => void;
  updateVideo: (videoId: string, updates: Partial<YouTubeStudioVideoRow>) => void;
  batchUpdateVideos: (updates: Array<{ videoId: string; updates: Partial<YouTubeStudioVideoRow> }>) => void;
  clearData: () => void;
}

export function useCatalogAnalytics(
  initialVideos: YouTubeStudioVideoRow[] = SAMPLE_COVER_VIDEOS
): UseCatalogAnalyticsReturn {
  const [rawVideos, setRawVideos] = useState<YouTubeStudioVideoRow[]>(initialVideos);
  const [dataSource, setDataSource] = useState<'sample' | 'custom_csv'>(
    initialVideos === SAMPLE_COVER_VIDEOS ? 'sample' : 'custom_csv'
  );
  const [fileName, setFileName] = useState<string | null>(
    initialVideos === SAMPLE_COVER_VIDEOS ? 'sample-cover-band-data.ts' : null
  );

  const [filters, setFilters] = useState<CatalogFilterState>({
    searchQuery: '',
    selectedGenre: 'ALL',
    selectedBottleneck: 'ALL',
    minViews: 0,
  });

  // Calculate full statistical catalog analytics
  const analytics = useMemo(() => {
    if (!rawVideos || rawVideos.length === 0) {
      return {
        videos: [],
        ageRegressionModel: null,
        repeatArtistScorecards: [],
        sequentialCoverDecaySummary: [],
      };
    }
    return analyzeYouTubeCatalog(rawVideos);
  }, [rawVideos]);

  // Extract unique genres and artists for quick filtering UI
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    rawVideos.forEach((v) => {
      if (v.macroGenre) set.add(v.macroGenre);
    });
    return Array.from(set).sort();
  }, [rawVideos]);

  const allArtists = useMemo(() => {
    const set = new Set<string>();
    rawVideos.forEach((v) => {
      if (v.parsedArtist) set.add(v.parsedArtist);
    });
    return Array.from(set).sort();
  }, [rawVideos]);

  // Filter videos based on user query, genre, and bottleneck selection
  const filteredVideos = useMemo(() => {
    return analytics.videos.filter((video) => {
      if (filters.minViews > 0 && video.views < filters.minViews) {
        return false;
      }
      if (filters.selectedGenre !== 'ALL') {
        if (video.macroGenre !== filters.selectedGenre) return false;
      }
      if (filters.selectedBottleneck !== 'ALL') {
        if (video.funnelBottleneck !== filters.selectedBottleneck) return false;
      }
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchesTitle = video.videoTitle.toLowerCase().includes(q);
        const matchesArtist = video.parsedArtist?.toLowerCase().includes(q);
        const matchesSong = video.parsedSongTitle?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesArtist && !matchesSong) return false;
      }
      return true;
    });
  }, [analytics.videos, filters]);

  const loadSampleData = useCallback(() => {
    setRawVideos(SAMPLE_COVER_VIDEOS);
    setDataSource('sample');
    setFileName('sample-cover-band-data.ts');
  }, []);

  const loadCustomVideos = useCallback(
    (videos: YouTubeStudioVideoRow[], name: string = 'Uploaded CSV') => {
      setRawVideos(videos);
      setDataSource('custom_csv');
      setFileName(name);
    },
    []
  );

  const updateVideo = useCallback(
    (videoId: string, updates: Partial<YouTubeStudioVideoRow>) => {
      setRawVideos((prev) =>
        prev.map((v) => (v.videoId === videoId ? { ...v, ...updates } : v))
      );
    },
    []
  );

  const batchUpdateVideos = useCallback(
    (updates: Array<{ videoId: string; updates: Partial<YouTubeStudioVideoRow> }>) => {
      const updateMap = new Map(updates.map((u) => [u.videoId, u.updates]));
      setRawVideos((prev) =>
        prev.map((v) => {
          const upd = updateMap.get(v.videoId);
          return upd ? { ...v, ...upd } : v;
        })
      );
    },
    []
  );

  const clearData = useCallback(() => {
    setRawVideos([]);
    setDataSource('custom_csv');
    setFileName(null);
  }, []);

  return {
    rawVideos,
    analytics,
    filteredVideos,
    filters,
    setFilters,
    dataSource,
    fileName,
    allGenres,
    allArtists,
    loadSampleData,
    loadCustomVideos,
    updateVideo,
    batchUpdateVideos,
    clearData,
  };
}
