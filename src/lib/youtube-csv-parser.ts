import Papa from 'papaparse';
import { YouTubeStudioVideoRow } from './youtube_studio_stats_engine';

/**
 * Parses duration strings from YouTube Studio exports into total seconds.
 * Handles:
 * - "MM:SS" (e.g., "04:12" -> 252)
 * - "HH:MM:SS" (e.g., "01:05:30" -> 3930)
 * - ISO 8601 (e.g., "PT4M12S", "PT1H5M30S", "PT45S")
 * - Numeric string or number (e.g., "252" -> 252)
 */
export function parseDurationToSeconds(input: string | number | undefined | null): number {
  if (input === undefined || input === null) return 0;
  if (typeof input === 'number') return isNaN(input) ? 0 : input;

  const raw = String(input).trim();
  if (!raw) return 0;

  // If plain number
  if (/^\d+(\.\d+)?$/.test(raw)) {
    return Math.round(parseFloat(raw));
  }

  // ISO 8601 Duration format: PT#H#M#S
  if (raw.startsWith('PT') || raw.startsWith('P')) {
    const hoursMatch = raw.match(/(\d+)H/i);
    const minsMatch = raw.match(/(\d+)M/i);
    const secsMatch = raw.match(/(\d+(?:\.\d+)?)S/i);

    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
    const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0;
    const secs = secsMatch ? parseFloat(secsMatch[1]) : 0;

    return Math.round(hours * 3600 + mins * 60 + secs);
  }

  // MM:SS or HH:MM:SS format
  const parts = raw.split(':').map((p) => p.trim());
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return Math.round(mins * 60 + secs);
  } else if (parts.length === 3) {
    const hours = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return Math.round(hours * 3600 + mins * 60 + secs);
  }

  return 0;
}

/**
 * Parses numeric strings with commas, percent signs, or spaces.
 */
export function parseCleanNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/,/g, '').replace(/%/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Deterministic Regex Parser for YouTube Cover Video Titles.
 * Handles common music and cover-band patterns:
 * - "Song Title" - Artist (Cover by First to Eleven)
 * - Artist - Song Title (Cover)
 * - Song Title - Artist Cover
 * - Song Title (Artist Cover)
 * - Artist - "Song Title" | Cover by Band
 */
export function extractSongAndArtistFromTitle(videoTitle: string): {
  parsedSongTitle?: string;
  parsedArtist?: string;
} {
  if (!videoTitle) return {};

  let clean = videoTitle.trim();

  // Strip common trailing metadata in brackets or parentheses like "(Official Video)", "[4K]", etc.
  // but keep "(Cover)" clues for now
  clean = clean.replace(/(\[|\()?(official\s*(music\s*)?video|audio|visualizer|lyrics?|4k|hd)(\]|\))/gi, '').trim();

  // Strip "Cover by First To Eleven", "Cover by ...", "Rock Cover by ...", etc.
  clean = clean.replace(/\((?:rock\s+|punk\s+|acoustic\s+|metal\s+)?cover(?:\s+by[^)]+)?\)/gi, '(Cover)');
  clean = clean.replace(/\[(?:rock\s+|punk\s+|acoustic\s+|metal\s+)?cover(?:\s+by[^\]]+)?\]/gi, '[Cover]');
  clean = clean.replace(/\|\s*(?:rock\s+|punk\s+|acoustic\s+|metal\s+)?cover(?:\s+by\s+[^\n|]+)?/gi, '');
  clean = clean.trim();

  // Pattern 1: "Song Title" - Artist (Cover) or "Song" - Artist
  // e.g. "Sweet Child O' Mine" - Guns N' Roses (Cover)
  const quotedSongMatch = clean.match(/^"([^"]+)"\s*[-–—]\s*([^([]+)(?:\s*[([]?(?:cover)?[)\]]?)?/i);
  if (quotedSongMatch) {
    return {
      parsedSongTitle: quotedSongMatch[1].trim(),
      parsedArtist: quotedSongMatch[2].replace(/[([]\s*cover\s*[)\]]/gi, '').trim(),
    };
  }

  // Pattern 2: Artist - "Song Title" (Cover)
  // e.g. Paramore - "Misery Business" (Cover)
  const quotedSongMatch2 = clean.match(/^([^"[-–—]+)\s*[-–—]\s*"([^"]+)"/i);
  if (quotedSongMatch2) {
    return {
      parsedArtist: quotedSongMatch2[1].trim(),
      parsedSongTitle: quotedSongMatch2[2].trim(),
    };
  }

  // Pattern 3: Song Title (Artist Cover)
  // e.g. Bad Guy (Billie Eilish Cover)
  const artistCoverInParensMatch = clean.match(/^([^(]+)\((.+?)\s+cover\)/i);
  if (artistCoverInParensMatch) {
    return {
      parsedSongTitle: artistCoverInParensMatch[1].trim(),
      parsedArtist: artistCoverInParensMatch[2].trim(),
    };
  }

  // Pattern 4: Artist - Song Title (Cover) or Artist - Song Title
  // e.g. Queen - Bohemian Rhapsody (Cover)
  // Note: We check if there's a delimiter '-' or '–' or '—'
  const dashSplit = clean.split(/\s*[-–—]\s*/);
  if (dashSplit.length >= 2) {
    let partA = dashSplit[0].trim();
    let partB = dashSplit.slice(1).join(' - ').replace(/[([]\s*cover\s*[)\]]/gi, '').trim();

    // Remove any trailing '| BandName' or '/ BandName'
    partB = partB.split(/\s*[|/]\s*/)[0].trim();

    // Often Part A is Artist and Part B is Song, or Part A is Song and Part B is Artist
    // Heuristic: Check if part B ends with "Cover" or if Part A had quotes
    return {
      parsedArtist: partA,
      parsedSongTitle: partB,
    };
  }

  return {};
}

/**
 * Maps raw CSV row object to YouTubeStudioVideoRow.
 */
function normalizeCsvRow(row: Record<string, any>): YouTubeStudioVideoRow | null {
  // Normalize header keys (lowercase, trimmed, strip quotes)
  const normalized: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    const k = key.trim().toLowerCase();
    normalized[k] = val;
  }

  // Find fields by key aliases
  const videoId =
    normalized['content'] ??
    normalized['video id'] ??
    normalized['video'] ??
    normalized['id'] ??
    '';

  const videoTitle =
    normalized['video title'] ??
    normalized['title'] ??
    normalized['video'] ??
    '';

  // Check if this is the summary "Total" row that YouTube Studio exports at index 0
  if (
    String(videoId).trim().toLowerCase() === 'total' ||
    String(videoTitle).trim().toLowerCase() === 'total' ||
    String(videoId).trim().startsWith('total')
  ) {
    return null;
  }

  if (!videoId && !videoTitle) {
    return null;
  }

  const publishDate =
    normalized['video publish time'] ??
    normalized['publish time'] ??
    normalized['published date'] ??
    normalized['publish date'] ??
    normalized['date'] ??
    new Date().toISOString().split('T')[0];

  const durationSeconds = parseDurationToSeconds(
    normalized['duration'] ?? normalized['video duration']
  );

  const views = parseCleanNumber(normalized['views']);
  const watchTimeHours = parseCleanNumber(
    normalized['watch time (hours)'] ?? normalized['watch time']
  );
  const subscribersNet = parseCleanNumber(
    normalized['subscribers'] ?? normalized['subscribers net'] ?? normalized['subscribers gained']
  );

  const averageViewDurationSeconds = parseDurationToSeconds(
    normalized['average view duration'] ?? normalized['avd']
  );

  const impressions = parseCleanNumber(normalized['impressions']);
  const impressionsCtrPct = parseCleanNumber(
    normalized['impressions click-through rate (%)'] ??
    normalized['impressions click-through rate'] ??
    normalized['impressions ctr (%)'] ??
    normalized['ctr (%)'] ??
    normalized['ctr']
  );

  // Extract song and artist using regex
  const { parsedSongTitle, parsedArtist } = extractSongAndArtistFromTitle(String(videoTitle));

  return {
    videoId: String(videoId).trim(),
    videoTitle: String(videoTitle).trim(),
    publishDate: String(publishDate).trim(),
    durationSeconds,
    views,
    watchTimeHours,
    subscribersNet,
    averageViewDurationSeconds,
    impressions,
    impressionsCtrPct,
    parsedSongTitle,
    parsedArtist,
  };
}

/**
 * Parses a raw YouTube Studio "Table data.csv" file string into YouTubeStudioVideoRow[]
 */
export function parseYouTubeStudioCsv(csvContent: string): {
  videos: YouTubeStudioVideoRow[];
  totalRowsProcessed: number;
  skippedSummaryRows: number;
  errors: string[];
} {
  const result = Papa.parse<Record<string, any>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const videos: YouTubeStudioVideoRow[] = [];
  let skippedSummaryRows = 0;
  const errors: string[] = result.errors.map((e) => `Row ${e.row}: ${e.message}`);

  for (let i = 0; i < result.data.length; i++) {
    const rawRow = result.data[i];
    const row = normalizeCsvRow(rawRow);
    if (!row) {
      skippedSummaryRows++;
      continue;
    }
    // Filter out rows with 0 or missing views and publish dates
    if (row.views >= 0) {
      videos.push(row);
    }
  }

  return {
    videos,
    totalRowsProcessed: result.data.length,
    skippedSummaryRows,
    errors,
  };
}
