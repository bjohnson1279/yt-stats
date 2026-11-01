# YouTube Studio Statistical Analyzer

An exploratory catalog dashboard for YouTube Studio CSV exports. Run `npm install`
and `npm run dev` to start locally.

## Content analysis across channel types

The Topics & Formats view groups videos by optional metadata columns added to a
Studio export. Search includes these fields. Existing artist, genre, cover
sequencing, and AI enrichment tools remain music-specific.

| CSV column | Purpose | Examples |
| --- | --- | --- |
| Topic (or Subject) | Primary subject of a video | A film, an episode, a band, a recurring satire target |
| Franchise (or Series) | Broader recurring universe or collection | Star Wars, a TV series, a recurring sketch series |
| Content format (or Format) | How the subject is presented | Review, recap, reaction, essay, parody, sketch, stand-up |
| Category (or Content category) | Broad editorial classification | Film, television, music, satire, comedy |

These fields are creator annotations, not assumed standard Studio export fields.
Each currently accepts one value per video. Untagged records appear as
Unclassified. Song-title heuristics only run for titles containing “cover”;
explicit Artist and Song title columns take precedence. Review inferred music
metadata before relying on it.

For example, a movie review might use Topic = Alien, Franchise = Alien,
Content format = Review, Category = Film. A fan channel can compare formats
within the same franchise; a comedy channel can tag recurring characters as
topics and sketches versus stand-up as formats.

Group totals and medians respect the dashboard filters. Age-adjusted multipliers
use the full catalog regression baseline. Groups with fewer than three videos
are flagged as small samples. These are descriptive comparisons, not causal
evidence or forecasts.

## Data limitations

The bundled cover-band demo is illustrative, not an authenticated Studio export.
Do not treat its private engagement metrics or external popularity figures as
verified measurements. Public lifetime views and a Studio reporting-period
export are different measurement contexts.

The existing parser represents missing numeric Studio fields as zero. Until
missingness and provenance are modeled explicitly, do not use funnel diagnoses,
CTR, or retention results for public-view-only or incomplete datasets. The
current age baseline also assumes comparable view-observation windows; comparing
fixed-period views to lifetime video age can be misleading.

## Evolution roadmap

1. Model metric availability, reporting windows, and provenance per import;
   suppress diagnostics when their inputs are absent rather than imputing zero.
2. Add editable metadata, reusable channel presets, multiple subject tags, and
   stable entity IDs with aliases. Mixed channels should not require one genre.
3. Generalize repeat-artist scorecards into repeat-subject and repeat-format
   cohorts; keep Spotify/original-song features as optional music enrichment.
4. Compare like-for-like cohorts by format, duration, and observation window;
   add release-event timing for reviews, recaps, trailers, and franchise news.
5. Make AI enrichment schema-aware and reviewable across channel types. Do not
   infer fictional characters, franchises, or satire targets as music artists.

No remote channel integration or automatic non-music title classification is
required for the current content-grouping workflow.
