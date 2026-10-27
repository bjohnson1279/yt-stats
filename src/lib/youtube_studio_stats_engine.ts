/**
 * youtube_studio_stats_engine.ts
 *
 * Core deterministic statistical analysis engine for YouTube Studio CSV exports
 * ("Table data.csv"), written in pure TypeScript with zero external math dependencies
 * (and compatible alongside `simple-statistics` or `DuckDB-Wasm`).
 *
 * Walk-through of the 5 core statistical concepts implemented here:
 *   1. Log10 Transformation: Why raw YouTube views are right-skewed and how log10
 *      makes linear regression work accurately.
 *   2. Pearson (r) vs. Spearman Rank (rho) Correlation: Measuring linear vs.
 *      monotonic relationships across views, CTR, impressions, and watch time.
 *   3. Ordinary Least Squares (OLS) Simple & Multiple Regression: Predicting
 *      "Expected Views" given video age (days since upload) and external popularity.
 *   4. Residuals & Performance Multipliers (10^residual): Turning abstract log
 *      residuals into intuitive "2.10x overperformance" vs. "0.45x underperformance" scores.
 *   5. Sequential Repeat-Artist / Repeat-Topic Decay Curves & Funnel Diagnostics:
 *      Pinpointing whether diminishing returns come from subscriber fatigue (low CTR),
 *      algorithmic suppression (low Impressions), or poor retention (low AVD).
 */

export interface YouTubeStudioVideoRow {
  videoId: string;                     // "Content" column in Table data.csv
  videoTitle: string;                  // "Video title"
  publishDate: string;                 // "Video publish time" (ISO or MMM DD, YYYY)
  durationSeconds: number;             // "Duration"
  views: number;                       // "Views"
  watchTimeHours: number;              // "Watch time (hours)"
  subscribersNet: number;              // "Subscribers"
  averageViewDurationSeconds: number;  // "Average view duration" (parsed to seconds)
  impressions: number;                 // "Impressions"
  impressionsCtrPct: number;           // "Impressions click-through rate (%)"

  // Optional enriched fields (parsed from title or fetched via Spotify / MusicBrainz API)
  parsedSongTitle?: string;
  parsedArtist?: string;
  macroGenre?: string;
  subgenre?: string;
  originalReleaseYear?: number;
  externalSpotifyStreams?: number;
  externalOriginalMvViews?: number;
}

export interface EnrichedVideoAnalytics extends YouTubeStudioVideoRow {
  daysSinceUpload: number;
  viewsPerDay: number;
  averagePercentageViewed: number;
  subscribersPer1kViews: number;
  log10Views: number;
  log10ExternalSpotify?: number;
  log10ExternalMvViews?: number;

  // Regression outputs
  expectedViewsAgeModel: number;
  ageModelLogResidual: number;
  ageModelMultiplier: number;          // e.g., 1.85x means +85% above age expectation

  expectedViewsCombinedModel?: number;
  combinedModelLogResidual?: number;
  combinedModelMultiplier?: number;

  // Sequential tracking for repeat artists / topics
  artistAppearanceNumber?: number;     // 1 = 1st cover of artist, 2 = 2nd cover, etc.
  funnelBottleneck: 'Breakout Hit' | 'Subscriber Fatigue (Low CTR)' | 'AlgorithmCapped (Low Impressions)' | 'Retention Drop (Low AVD)' | 'Baseline Performer';
}

export interface RegressionModelSummary {
  intercept: number;
  slopes: Record<string, number>;
  rSquared: number;
  adjustedRSquared: number;
  sampleSize: number;
}

export interface RepeatArtistScorecard {
  artist: string;
  coversCount: number;
  totalViews: number;
  medianViews: number;
  meanViews: number;
  meanCtrPct: number;
  meanRetentionPct: number;
  geometricMeanAgeMultiplier: number;
  geometricMeanCombinedMultiplier?: number;
  modelWinRatePct: number;
  decaySlopeLogViewsPerCover: number;  // Negative = declining views across repeats; Positive = growing
  chronologicalCovers: Array<{
    coverNumber: number;
    songTitle: string;
    publishDate: string;
    views: number;
    ctrPct: number;
    ageMultiplier: number;
    combinedMultiplier?: number;
  }>;
}

// ============================================================================
// 1. BASIC DESCRIPTIVE STATS & CORRELATIONS (Pearson r vs. Spearman rho)
// ============================================================================

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Pearson Correlation Coefficient (r):
 * Measures the strength and direction of a LINEAR relationship (-1 to +1).
 * Always use log10(views) rather than raw views when computing Pearson r on YouTube data,
 * otherwise 1 or 2 viral outliers (like a 77M-view video) will dominate the entire formula.
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

/**
 * Spearman Rank Correlation (rho):
 * Converts raw numbers into ranks (1st, 2nd, 3rd...) before running Pearson correlation.
 * Resistant to extreme viral outliers.
 */
export function spearmanRankCorrelation(x: number[], y: number[]): number {
  const toRanks = (arr: number[]): number[] => {
    const indexed = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
    const ranks = new Array<number>(arr.length);
    let i = 0;
    while (i < indexed.length) {
      let j = i;
      while (j + 1 < indexed.length && indexed[j + 1].val === indexed[i].val) {
        j++;
      }
      const avgRank = (i + j + 2) / 2;
      for (let k = i; k <= j; k++) {
        ranks[indexed[k].idx] = avgRank;
      }
      i = j + 1;
    }
    return ranks;
  };
  return pearsonCorrelation(toRanks(x), toRanks(y));
}

// ============================================================================
// 2. ORDINARY LEAST SQUARES (OLS) SIMPLE & MULTIPLE LINEAR REGRESSION
// ============================================================================

/**
 * Solves Ordinary Least Squares (OLS) Multiple Linear Regression:
 *   y = beta_0 + beta_1 * x_1 + beta_2 * x_2 + ... + epsilon
 * using Gaussian elimination on the normal equations (X^T * X) * beta = X^T * y.
 *
 * Why this matters for YouTube Studio data:
 * Older videos naturally have more views than newer videos, and famous songs naturally
 * get more searches than obscure songs. Multiple regression lets us control for
 * BOTH video age and original song popularity simultaneously!
 */
export function fitMultipleLinearRegression(
  y: number[],
  predictors: Record<string, number[]>
): { model: RegressionModelSummary; predictions: number[]; residuals: number[] } {
  const featureNames = Object.keys(predictors);
  const n = y.length;
  const k = featureNames.length;
  const p = k + 1; // +1 for intercept column

  // Build design matrix X (n x p) where column 0 is all 1s (intercept)
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = [1];
    for (const name of featureNames) {
      row.push(predictors[name][i]);
    }
    X.push(row);
  }

  // Compute X^T * X (p x p) and X^T * y (p x 1)
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty: number[] = new Array(p).fill(0);

  for (let i = 0; i < n; i++) {
    for (let r = 0; r < p; r++) {
      Xty[r] += X[i][r] * y[i];
      for (let c = 0; c < p; c++) {
        XtX[r][c] += X[i][r] * X[i][c];
      }
    }
  }

  // Solve (XtX) * beta = Xty via Gaussian elimination with partial pivoting
  const A = XtX.map((row, idx) => [...row, Xty[idx]]);
  for (let col = 0; col < p; col++) {
    let maxRow = col;
    for (let row = col + 1; row < p; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) {
        maxRow = row;
      }
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];

    const pivot = A[col][col] || 1e-12;
    for (let j = col; j <= p; j++) {
      A[col][j] /= pivot;
    }
    for (let row = 0; row < p; row++) {
      if (row !== col) {
        const factor = A[row][col];
        for (let j = col; j <= p; j++) {
          A[row][j] -= factor * A[col][j];
        }
      }
    }
  }

  const betas = A.map((row) => row[p]);
  const intercept = betas[0];
  const slopes: Record<string, number> = {};
  featureNames.forEach((name, idx) => {
    slopes[name] = betas[idx + 1];
  });

  // Compute predictions, residuals, and R^2
  const yMean = mean(y);
  let ssTot = 0;
  let ssRes = 0;
  const predictions: number[] = [];
  const residuals: number[] = [];

  for (let i = 0; i < n; i++) {
    let yHat = intercept;
    for (let j = 0; j < k; j++) {
      yHat += betas[j + 1] * X[i][j + 1];
    }
    const res = y[i] - yHat;
    predictions.push(yHat);
    residuals.push(res);
    ssTot += (y[i] - yMean) ** 2;
    ssRes += res ** 2;
  }

  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const adjustedRSquared =
    n - k - 1 <= 0 ? rSquared : 1 - ((1 - rSquared) * (n - 1)) / (n - k - 1);

  return {
    model: { intercept, slopes, rSquared, adjustedRSquared, sampleSize: n },
    predictions,
    residuals,
  };
}

// ============================================================================
// 3. FULL PIPELINE: ENRICH VIDEOS, COMPUTE MULTIPLIERS & DIAGNOSE FUNNEL
// ============================================================================

export function analyzeYouTubeCatalog(
  rawVideos: YouTubeStudioVideoRow[],
  referenceDate: Date = new Date()
): {
  videos: EnrichedVideoAnalytics[];
  ageRegressionModel: RegressionModelSummary;
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
} {
  // Sort chronologically so sequential artist appearance numbers (#1, #2, #3...) are accurate
  const sorted = [...rawVideos]
    .filter((v) => v.views > 0)
    .sort((a, b) => new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime());

  const artistCountsSoFar = new Map<string, number>();

  const prelim: EnrichedVideoAnalytics[] = sorted.map((v) => {
    const pubMs = new Date(v.publishDate).getTime();
    const daysSinceUpload = Math.max(1, Math.round((referenceDate.getTime() - pubMs) / 86_400_000));
    const viewsPerDay = v.views / daysSinceUpload;
    const averagePercentageViewed =
      v.durationSeconds > 0 ? (v.averageViewDurationSeconds / v.durationSeconds) * 100 : 0;
    const subscribersPer1kViews = (v.subscribersNet / v.views) * 1000;

    let artistAppearanceNumber: number | undefined;
    if (v.parsedArtist) {
      const nextNum = (artistCountsSoFar.get(v.parsedArtist) ?? 0) + 1;
      artistCountsSoFar.set(v.parsedArtist, nextNum);
      artistAppearanceNumber = nextNum;
    }

    return {
      ...v,
      daysSinceUpload,
      viewsPerDay,
      averagePercentageViewed,
      subscribersPer1kViews,
      log10Views: Math.log10(v.views),
      log10ExternalSpotify:
        v.externalSpotifyStreams && v.externalSpotifyStreams > 0
          ? Math.log10(v.externalSpotifyStreams)
          : undefined,
      log10ExternalMvViews:
        v.externalOriginalMvViews && v.externalOriginalMvViews > 0
          ? Math.log10(v.externalOriginalMvViews)
          : undefined,
      expectedViewsAgeModel: v.views,
      ageModelLogResidual: 0,
      ageModelMultiplier: 1,
      artistAppearanceNumber,
      funnelBottleneck: 'Baseline Performer',
    };
  });

  // Step A: Fit Age-Only Regression Model: log10(Views) = b0 + b1 * Days_Since_Upload
  const yLogViews = prelim.map((v) => v.log10Views);
  const xDays = prelim.map((v) => v.daysSinceUpload);
  const ageFit = fitMultipleLinearRegression(yLogViews, { daysSinceUpload: xDays });

  prelim.forEach((v, idx) => {
    const predLog = ageFit.predictions[idx];
    const resLog = ageFit.residuals[idx];
    v.expectedViewsAgeModel = Math.round(10 ** predLog);
    v.ageModelLogResidual = resLog;
    // Because the model is in log10 space, 10^(residual) = Actual_Views / Expected_Views!
    v.ageModelMultiplier = 10 ** resLog;
  });

  // Step B: If external popularity data is present on all rows, fit Combined Regression Model
  let combinedRegressionModel: RegressionModelSummary | undefined;
  const hasExternalPopularity = prelim.every(
    (v) => v.log10ExternalSpotify !== undefined && v.log10ExternalMvViews !== undefined
  );

  if (hasExternalPopularity && prelim.length >= 5) {
    const combFit = fitMultipleLinearRegression(yLogViews, {
      daysSinceUpload: xDays,
      log10ExternalMvViews: prelim.map((v) => v.log10ExternalMvViews!),
      log10ExternalSpotify: prelim.map((v) => v.log10ExternalSpotify!),
    });
    combinedRegressionModel = combFit.model;
    prelim.forEach((v, idx) => {
      v.expectedViewsCombinedModel = Math.round(10 ** combFit.predictions[idx]);
      v.combinedModelLogResidual = combFit.residuals[idx];
      v.combinedModelMultiplier = 10 ** combFit.residuals[idx];
    });
  }

  // Step C: Diagnose Funnel Bottleneck per Video using channel medians
  const medianCtr = median(prelim.map((v) => v.impressionsCtrPct));
  const medianRetention = median(prelim.map((v) => v.averagePercentageViewed));
  const medianImpressions = median(prelim.map((v) => v.impressions));

  prelim.forEach((v) => {
    const mult = v.combinedModelMultiplier ?? v.ageModelMultiplier;
    if (mult >= 1.5) {
      v.funnelBottleneck = 'Breakout Hit';
    } else if (mult < 0.8 && v.impressionsCtrPct < medianCtr * 0.85) {
      v.funnelBottleneck = 'Subscriber Fatigue (Low CTR)';
    } else if (mult < 0.8 && v.impressions < medianImpressions * 0.7) {
      v.funnelBottleneck = 'AlgorithmCapped (Low Impressions)';
    } else if (mult < 0.8 && v.averagePercentageViewed < medianRetention * 0.85) {
      v.funnelBottleneck = 'Retention Drop (Low AVD)';
    } else {
      v.funnelBottleneck = 'Baseline Performer';
    }
  });

  // Step D: Build Repeat-Artist Scorecards
  const byArtist = new Map<string, EnrichedVideoAnalytics[]>();
  prelim.forEach((v) => {
    if (!v.parsedArtist) return;
    const list = byArtist.get(v.parsedArtist) ?? [];
    list.push(v);
    byArtist.set(v.parsedArtist, list);
  });

  const repeatArtistScorecards: RepeatArtistScorecard[] = [];
  byArtist.forEach((vids, artist) => {
    if (vids.length < 2) return;
    const logAgeResiduals = vids.map((v) => v.ageModelLogResidual);
    const geomAgeMult = 10 ** mean(logAgeResiduals);

    const hasComb = vids.every((v) => v.combinedModelLogResidual !== undefined);
    const geomCombMult = hasComb
      ? 10 ** mean(vids.map((v) => v.combinedModelLogResidual!))
      : undefined;

    const wins = vids.filter(
      (v) => (v.combinedModelLogResidual ?? v.ageModelLogResidual) > 0
    ).length;

    // Slope of log10(views) across sequential cover number (1, 2, ... n)
    const coverNums = vids.map((_, i) => i + 1);
    const slopeFit = fitMultipleLinearRegression(
      vids.map((v) => v.log10Views),
      { coverNum: coverNums }
    );

    repeatArtistScorecards.push({
      artist,
      coversCount: vids.length,
      totalViews: vids.reduce((s, v) => s + v.views, 0),
      medianViews: median(vids.map((v) => v.views)),
      meanViews: mean(vids.map((v) => v.views)),
      meanCtrPct: mean(vids.map((v) => v.impressionsCtrPct)),
      meanRetentionPct: mean(vids.map((v) => v.averagePercentageViewed)),
      geometricMeanAgeMultiplier: geomAgeMult,
      geometricMeanCombinedMultiplier: geomCombMult,
      modelWinRatePct: (wins / vids.length) * 100,
      decaySlopeLogViewsPerCover: slopeFit.model.slopes.coverNum,
      chronologicalCovers: vids.map((v, i) => ({
        coverNumber: i + 1,
        songTitle: v.parsedSongTitle ?? v.videoTitle,
        publishDate: v.publishDate,
        views: v.views,
        ctrPct: v.impressionsCtrPct,
        ageMultiplier: v.ageModelMultiplier,
        combinedMultiplier: v.combinedModelMultiplier,
      })),
    });
  });

  repeatArtistScorecards.sort(
    (a, b) =>
      (b.geometricMeanCombinedMultiplier ?? b.geometricMeanAgeMultiplier) -
      (a.geometricMeanCombinedMultiplier ?? a.geometricMeanAgeMultiplier)
  );

  // Step E: Sequential Cover Decay Curve (#1, #2, #3, #4, #5+)
  const buckets = ['1', '2', '3', '4', '5+'];
  const sequentialCoverDecaySummary = buckets.map((bucket) => {
    const matching = prelim.filter((v) => {
      if (!v.artistAppearanceNumber || (byArtist.get(v.parsedArtist!)?.length ?? 0) < 2) {
        return false;
      }
      return bucket === '5+'
        ? v.artistAppearanceNumber >= 5
        : String(v.artistAppearanceNumber) === bucket;
    });
    const wins = matching.filter(
      (v) => (v.combinedModelLogResidual ?? v.ageModelLogResidual) > 0
    ).length;
    return {
      appearanceBucket: `Cover #${bucket}`,
      videoCount: matching.length,
      medianViews: matching.length ? median(matching.map((v) => v.views)) : 0,
      meanCtrPct: matching.length ? mean(matching.map((v) => v.impressionsCtrPct)) : 0,
      geometricMeanAgeMultiplier: matching.length
        ? 10 ** mean(matching.map((v) => v.ageModelLogResidual))
        : 0,
      winRatePct: matching.length ? (wins / matching.length) * 100 : 0,
    };
  });

  return {
    videos: prelim,
    ageRegressionModel: ageFit.model,
    combinedRegressionModel,
    repeatArtistScorecards,
    sequentialCoverDecaySummary,
  };
}