#!/usr/bin/env python3
"""
harvest_channel.py

Generic, Channel-Agnostic YouTube Harvester & OLS Regression Engine.

WHAT THIS SCRIPT DOES:
  1. Resolves any YouTube channel (via handle, channel ID, username, or URL).
  2. Paginates through 100% of the channel's public uploads via YouTube Data API v3.
  3. Fetches exact view counts, like counts, comment counts, publish dates, and durations.
  4. Filters YouTube Shorts (configurable threshold, default <= 65s).
  5. Deterministically parses song titles and original artists from cover video titles
     (or extracts topics/formats for general channels).
  6. Computes Days Since Upload, Views Per Day, and the full Log10 OLS Age Regression
     Model (R², Intercept, Slope, Expected Views, and Age Multipliers).
  7. Generates clean CSVs that are 100% compatible with the yt-studio-analyzer dashboard
     and can be dropped directly into the web UI.

SECURITY & CONFIGURATION:
  API keys are never hardcoded. The script automatically reads your YouTube API key from:
    1. CLI argument: --api-key "YOUR_KEY"
    2. Environment variable: YOUTUBE_API_KEY (or YOUTUBE_DATA_API_KEY)
    3. Local .env.local or .env file in the project directory (ignored by git)

USAGE EXAMPLES:
  # Basic usage with a channel handle (reads key from .env.local or environment):
  python harvest_channel.py --channel @WalkOffTheEarth

  # Filter strictly to covers:
  python harvest_channel.py --channel @FirstToEleven --covers-only

  # Custom output paths:
  python harvest_channel.py --channel @Pomplamoose --output pomplamoose_stats.csv

  # Include Shorts:
  python harvest_channel.py --channel @MrBeast --include-shorts
"""

import argparse
import math
import os
import re
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import requests


# ---------------------------------------------------------------------------
# 1. Secure Environment & API Key Loader
# ---------------------------------------------------------------------------

def load_env_file() -> None:
    """
    Lightweight zero-dependency loader for .env.local and .env files.
    Checks the current working directory and the script's directory.
    """
    candidates = [
        os.path.join(os.getcwd(), ".env.local"),
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
    ]
    seen = set()
    for filepath in candidates:
        filepath = os.path.normpath(filepath)
        if filepath in seen or not os.path.exists(filepath):
            continue
        seen.add(filepath)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass


def get_youtube_api_key(cli_key: Optional[str] = None) -> str:
    """
    Resolves the YouTube API key using a hierarchical fallback:
      1. Explicit CLI argument
      2. Environment variable (YOUTUBE_API_KEY or YOUTUBE_DATA_API_KEY)
      3. .env.local or .env file in workspace
    """
    load_env_file()

    api_key = (
        (cli_key or "").strip()
        or os.environ.get("YOUTUBE_API_KEY", "").strip()
        or os.environ.get("YOUTUBE_DATA_API_KEY", "").strip()
    )

    if not api_key:
        print("\n" + "=" * 70)
        print("[!] ERROR: YouTube API key not found.")
        print("=" * 70)
        print("To fix this, provide your key via any of these secure methods:\n")
        print("  Option A (Recommended for this project):")
        print('    Add your key to .env.local in the project root:')
        print('      YOUTUBE_API_KEY=AIzaSy...\n')
        print("  Option B (Shell environment variable):")
        print('    export YOUTUBE_API_KEY="AIzaSy..."   (Linux/macOS)')
        print('    $env:YOUTUBE_API_KEY="AIzaSy..."      (Windows PowerShell)\n')
        print("  Option C (CLI parameter):")
        print('    python harvest_channel.py --channel @Handle --api-key "AIzaSy..."\n')
        print("Get a free key at: https://console.cloud.google.com/apis/credentials")
        print("=" * 70 + "\n")
        sys.exit(1)

    return api_key


# ---------------------------------------------------------------------------
# 2. Parsing Helpers (Durations, Titles, Channel Identifiers)
# ---------------------------------------------------------------------------

def parse_iso8601_duration(duration_str: str) -> int:
    """Converts ISO 8601 duration (e.g. 'PT3M42S', 'PT1H2M', 'PT45S') to total seconds."""
    match = re.match(r"^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$", duration_str or "")
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(float(match.group(3) or 0))
    return hours * 3600 + minutes * 60 + seconds


def format_duration(seconds: int) -> str:
    """Formats total seconds into MM:SS or HH:MM:SS format."""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def slugify(text: str) -> str:
    """Converts a channel name or string into a safe filename slug."""
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "_", text) or "youtube_channel"


def extract_channel_query(channel_input: str) -> Tuple[str, str]:
    """
    Parses channel input string into (query_type, query_value).
    Supports:
      - Handle: '@walkofftheearth' or 'walkofftheearth'
      - Channel ID: 'UC...'
      - URL: 'https://www.youtube.com/@walkofftheearth', 'https://youtube.com/channel/UC...'
    """
    raw = channel_input.strip()

    # If it's a URL, extract path segment
    if "youtube.com" in raw or "youtu.be" in raw:
        path = re.sub(r"^https?://(www\.)?youtube\.com/", "", raw).split("?")[0].strip("/")
        if path.startswith("@"):
            return "handle", path.lstrip("@")
        if path.startswith("channel/"):
            return "id", path.replace("channel/", "")
        if path.startswith("c/"):
            return "custom", path.replace("c/", "")
        if path.startswith("user/"):
            return "username", path.replace("user/", "")
        # Bare handle in path
        if "/" not in path and not path.startswith("watch"):
            return "handle", path.lstrip("@")

    # If starts with UC and length 24, it's a channel ID
    if raw.startswith("UC") and len(raw) == 24:
        return "id", raw

    # Explicit or assumed handle
    return "handle", raw.lstrip("@")


def parse_generic_cover_title(
    raw_title: str, channel_name: Optional[str] = None
) -> Tuple[Optional[str], Optional[str], bool]:
    """
    Extracts (Song_Title, Original_Artist, is_valid_cover) from a video title.
    Channel-agnostic: dynamically cleans the channel's own name/handle if provided.
    """
    lower = raw_title.lower()

    # Identify explicit non-music / non-cover content
    exclude_keywords = [
        "q&a", "vlog", "tour blog", "behind the scenes", "bloopers",
        "livestream", "live stream", "podcast", "unboxing", "reacts",
        "announcement", "patreon", "thank you", "trailer"
    ]
    if any(k in lower for k in exclude_keywords) and "cover" not in lower:
        return None, None, False

    cleaned = raw_title.strip()

    # Dynamically remove channel name if present in parentheticals (e.g. "(Cover by BandName)")
    if channel_name:
        escaped_channel = re.escape(channel_name)
        cleaned = re.sub(rf"\s*[\(\[][^)\]]*{escaped_channel}[^)\]]*[\)\]]", "", cleaned, flags=re.I).strip()

    # Remove generic trailing tags: [Official Video], (Rock Cover), [4K], etc.
    cleaned = re.sub(
        r"\s*[\(\[](?:official\s*(?:music\s*)?video|video|audio|visualizer|lyrics?|4k|hd|live|session)[\)\]]",
        "",
        cleaned,
        flags=re.I
    ).strip()

    # Remove generic cover markers from parentheticals
    cleaned = re.sub(
        r"\s*[\(\[](?:(?:rock|punk|acoustic|metal|pop|reggae|orchestral)\s+)?cover(?:\s+by[^\)\]]+)?[\)\]]",
        "",
        cleaned,
        flags=re.I
    ).strip()

    # Pattern 1: "Song Title" - Artist
    quotes_match = re.match(r'^["“]([^"”]+)["”]\s*[-–—]\s*(.+)$', cleaned)
    if quotes_match:
        song = quotes_match.group(1).strip()
        artist = quotes_match.group(2).strip()
        artist = re.sub(r"\s*[\(\[][^)\]]*cover[^)\]]*[\)\]]", "", artist, flags=re.I).strip()
        return song, artist, True

    # Pattern 2: Artist - "Song Title"
    quotes_match2 = re.match(r'^([^-–—]+)\s*[-–—]\s*["“]([^"”]+)["”]', cleaned)
    if quotes_match2:
        artist = quotes_match2.group(1).strip()
        song = quotes_match2.group(2).strip()
        return song, artist, True

    # Pattern 3: Song Title by Artist
    by_match = re.match(r'^"?([^"]+)"?\s+by\s+(.+)$', cleaned, flags=re.I)
    if by_match:
        song = by_match.group(1).strip()
        artist = by_match.group(2).strip()
        return song, artist, True

    # Pattern 4: Song Title (Artist Cover)
    parens_cover_match = re.match(r'^([^(]+)\((.+?)\s+cover\)', cleaned, flags=re.I)
    if parens_cover_match:
        song = parens_cover_match.group(1).strip()
        artist = parens_cover_match.group(2).strip()
        return song, artist, True

    # Pattern 5: Standard hyphen: 'Artist - Song' or 'Song - Artist'
    parts = re.split(r"\s+[-–—]\s+", cleaned, maxsplit=1)
    if len(parts) == 2:
        left = parts[0].strip().strip('"').strip("“”")
        right = parts[1].strip().strip('"').strip("“”")
        right = re.sub(r"\s*[\(\[][^)\]]*cover[^)\]]*[\)\]]", "", right, flags=re.I).strip()
        # If right side has cover indicators or left looks like song
        return left, right, ("cover" in lower or " - " in raw_title)

    return cleaned, "Unknown", ("cover" in lower)


# ---------------------------------------------------------------------------
# 3. YouTube Data API v3 Harvester Functions
# ---------------------------------------------------------------------------

def resolve_channel_details(api_key: str, channel_input: str) -> Dict[str, Any]:
    """
    Fetches the channel's title, custom URL, uploads playlist ID, and total videos.
    """
    query_type, query_val = extract_channel_query(channel_input)
    url = "https://www.googleapis.com/youtube/v3/channels"

    params: Dict[str, Any] = {
        "part": "snippet,contentDetails,statistics",
        "key": api_key,
    }

    if query_type == "id":
        params["id"] = query_val
    elif query_type == "handle":
        params["forHandle"] = query_val
    elif query_type == "username":
        params["forUsername"] = query_val
    else:
        params["forHandle"] = query_val

    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    items = data.get("items", [])
    if not items:
        # Fallback: if forHandle failed, try search
        if query_type == "handle":
            search_url = "https://www.googleapis.com/youtube/v3/search"
            s_params = {
                "part": "snippet",
                "q": query_val,
                "type": "channel",
                "maxResults": 1,
                "key": api_key,
            }
            s_resp = requests.get(search_url, params=s_params, timeout=15)
            s_resp.raise_for_status()
            s_items = s_resp.json().get("items", [])
            if s_items:
                cid = s_items[0]["snippet"]["channelId"]
                return resolve_channel_details(api_key, cid)

        raise RuntimeError(f"Could not locate YouTube channel for query: '{channel_input}'")

    channel_info = items[0]
    uploads_id = channel_info["contentDetails"]["relatedPlaylists"]["uploads"]
    title = channel_info["snippet"].get("title", "Unknown Channel")
    custom_url = channel_info["snippet"].get("customUrl", "")
    video_count = channel_info["statistics"].get("videoCount", "unknown")

    return {
        "channel_id": channel_info["id"],
        "channel_title": title,
        "custom_url": custom_url or (f"@{query_val}" if query_type == "handle" else ""),
        "uploads_playlist_id": uploads_id,
        "total_video_count": video_count,
    }


def fetch_all_playlist_video_ids(api_key: str, playlist_id: str) -> List[str]:
    """Paginates through playlistItems.list to fetch all video IDs."""
    video_ids: List[str] = []
    page_token = None
    url = "https://www.googleapis.com/youtube/v3/playlistItems"

    sys.stdout.write("[*] Paginating uploads playlist: ")
    sys.stdout.flush()

    while True:
        params = {
            "part": "contentDetails",
            "playlistId": playlist_id,
            "maxResults": 50,
            "key": api_key,
        }
        if page_token:
            params["pageToken"] = page_token

        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        for item in data.get("items", []):
            vid = item.get("contentDetails", {}).get("videoId")
            if vid:
                video_ids.append(vid)

        sys.stdout.write(f"\r[*] Paginating uploads playlist: {len(video_ids)} video IDs retrieved...")
        sys.stdout.flush()

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    sys.stdout.write("\n")
    return video_ids


def fetch_video_details_in_batches(api_key: str, video_ids: List[str]) -> List[Dict[str, Any]]:
    """Batches video IDs into groups of 50 via videos.list to fetch metadata and stats."""
    rows: List[Dict[str, Any]] = []
    url = "https://www.googleapis.com/youtube/v3/videos"
    total = len(video_ids)

    for i in range(0, total, 50):
        batch = video_ids[i : i + 50]
        params = {
            "part": "snippet,statistics,contentDetails",
            "id": ",".join(batch),
            "key": api_key,
        }
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        for item in data.get("items", []):
            vid = item["id"]
            snippet = item.get("snippet", {})
            stats = item.get("statistics", {})
            cd = item.get("contentDetails", {})

            duration_sec = parse_iso8601_duration(cd.get("duration", ""))
            pub_date = (snippet.get("publishedAt", "") or "")[:10]

            rows.append({
                "Video_ID": vid,
                "Content": vid,  # Alias for YouTube Studio "Table data.csv" compatibility
                "Video_Title": snippet.get("title", ""),
                "Publish_Date": pub_date,
                "Duration_Seconds": duration_sec,
                "Duration_Formatted": format_duration(duration_sec),
                "Views": int(stats.get("viewCount", 0)),
                "Likes": int(stats.get("likeCount", 0)),
                "Comments": int(stats.get("commentCount", 0)),
                "YouTube_URL": f"https://www.youtube.com/watch?v={vid}",
            })

        sys.stdout.write(f"\r[*] Fetching video details: {min(i + 50, total)} / {total} fetched...")
        sys.stdout.flush()

    sys.stdout.write("\n")
    return rows


# ---------------------------------------------------------------------------
# 4. Statistical Modeling & OLS Regression
# ---------------------------------------------------------------------------

def run_ols_log_linear(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Computes Log10 OLS Regression:
      log10(Views) = beta_0 + beta_1 * Days_Since_Upload

    Outputs:
      - Age_Only_Expected_Views
      - Age_Only_Multiplier (Views / Expected)
      - Age_Only_Log_Residual
      - Regression Model Summary (R², Slope, Intercept)
    """
    n = len(df)
    if n < 3:
        df["Age_Only_Expected_Views"] = df["Views"]
        df["Age_Only_Multiplier"] = 1.0
        df["Age_Only_Log_Residual"] = 0.0
        return df, {"r_squared": 0.0, "intercept": 0.0, "slope": 0.0, "n": n}

    y = np.log10(df["Views"].clip(lower=1).values.astype(float))
    days = df["Days_Since_Upload"].clip(lower=1).values.astype(float)

    # Simple OLS with Intercept
    X = np.column_stack([np.ones(n), days])
    beta, residuals, rank, s = np.linalg.lstsq(X, y, rcond=None)
    intercept, slope = beta[0], beta[1]

    fitted_log_y = X @ beta
    expected_views = 10 ** fitted_log_y

    # Calculate R-squared
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    ss_res = np.sum((y - fitted_log_y) ** 2)
    r_squared = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    df["Age_Only_Expected_Views"] = np.round(expected_views).astype(int)
    df["Age_Only_Multiplier"] = np.round(df["Views"] / expected_views, 2)
    df["Age_Only_Log_Residual"] = np.round(y - fitted_log_y, 4)

    # Optional: If seed CSV enriched Spotify and Original MV counts are present
    if "Spotify_Total_Streams" in df.columns and "Original_MV_Views" in df.columns:
        valid_mask = (df["Spotify_Total_Streams"].fillna(0) > 0) & (df["Original_MV_Views"].fillna(0) > 0)
        if valid_mask.sum() >= 10:
            sub = df.loc[valid_mask]
            y_sub = np.log10(sub["Views"].values.astype(float))
            d_sub = sub["Days_Since_Upload"].values.astype(float)
            mv_sub = np.log10(sub["Original_MV_Views"].values.astype(float))
            sp_sub = np.log10(sub["Spotify_Total_Streams"].values.astype(float))

            X_comb = np.column_stack([np.ones(len(sub)), d_sub, mv_sub, sp_sub])
            beta_comb, _, _, _ = np.linalg.lstsq(X_comb, y_sub, rcond=None)
            exp_comb = 10 ** (X_comb @ beta_comb)
            df.loc[valid_mask, "Combined_Model_Expected_Views"] = np.round(exp_comb).astype(int)
            df.loc[valid_mask, "Combined_Model_Multiplier"] = np.round(sub["Views"].values / exp_comb, 2)

    stats = {
        "r_squared": round(float(r_squared), 4),
        "intercept": round(float(intercept), 4),
        "slope": round(float(slope), 6),
        "n": n,
    }
    return df, stats


def compute_repeat_artist_scorecard(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes repeat appearance tracking and scorecard for artists/topics
    with multiple appearances in the catalog.
    """
    if "Artist" not in df.columns or df["Artist"].dropna().empty:
        return pd.DataFrame()

    valid_artists = df[~df["Artist"].isin(["Unknown", "Various", ""])].copy()
    if valid_artists.empty:
        return pd.DataFrame()

    # Track chronological appearance order
    valid_artists = valid_artists.sort_values("Publish_Date", ascending=True)
    valid_artists["Artist_Appearance_Number"] = valid_artists.groupby("Artist").cumcount() + 1

    # Aggregate by Artist
    grouped = valid_artists.groupby("Artist")
    scorecard = grouped.agg(
        Total_Covers=("Video_ID", "count"),
        Total_Views=("Views", "sum"),
        Median_Views=("Views", "median"),
        Mean_Views=("Views", "mean"),
        Mean_Age_Multiplier=("Age_Only_Multiplier", "mean"),
        Win_Rate_Pct=("Age_Only_Multiplier", lambda s: round(100.0 * (s >= 1.0).mean(), 1)),
    ).reset_index()

    # Geometric mean multiplier
    def geom_mean(series: pd.Series) -> float:
        valid = series[series > 0]
        if valid.empty:
            return 1.0
        return round(float(np.exp(np.mean(np.log(valid)))), 2)

    geom_multipliers = grouped["Age_Only_Multiplier"].apply(geom_mean).reset_index(name="Geometric_Mean_Multiplier")
    scorecard = pd.merge(scorecard, geom_multipliers, on="Artist")

    # Order by total covers and total views
    scorecard = scorecard.sort_values(["Total_Covers", "Total_Views"], ascending=[False, False]).reset_index(drop=True)
    return scorecard


# ---------------------------------------------------------------------------
# 5. CLI Execution & Main Orchestrator
# ---------------------------------------------------------------------------

def parse_cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generic YouTube Channel Harvester & Log10 OLS Regression Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python harvest_channel.py --channel @WalkOffTheEarth
  python harvest_channel.py --channel @FirstToEleven --covers-only
  python harvest_channel.py --channel UC_x5XG1OV2P6uZZ5FSM9Ttw --output my_channel.csv
  python harvest_channel.py --channel @MrBeast --include-shorts
        """,
    )
    parser.add_argument(
        "--channel",
        "-c",
        type=str,
        default=None,
        help="YouTube handle (@Name), channel ID (UC...), or full YouTube channel URL",
    )
    parser.add_argument(
        "--api-key",
        "-k",
        type=str,
        default=None,
        help="YouTube Data API v3 key (default: read from .env.local or YOUTUBE_API_KEY environment variable)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=None,
        help="Path for output catalog stats CSV (default: <channel_slug>_full_channel_stats.csv)",
    )
    parser.add_argument(
        "--scorecard-output",
        type=str,
        default=None,
        help="Path for repeat artist/topic scorecard CSV (default: <channel_slug>_artist_scorecard.csv)",
    )
    parser.add_argument(
        "--seed-csv",
        "-s",
        type=str,
        default=None,
        help="Optional seed CSV to merge external Spotify / Original MV views by Video_ID",
    )
    parser.add_argument(
        "--covers-only",
        action="store_true",
        help="Filter results strictly to identified covers (for cover band and music analysis)",
    )
    parser.add_argument(
        "--include-shorts",
        action="store_true",
        help="Include YouTube Shorts (by default, videos <= 65 seconds are filtered out)",
    )
    parser.add_argument(
        "--min-duration",
        type=int,
        default=65,
        help="Minimum video duration in seconds to exclude Shorts (default: 65)",
    )

    return parser.parse_args()


def main():
    args = parse_cli_args()

    # 1. Resolve API Key
    api_key = get_youtube_api_key(args.api_key)

    # 2. Resolve Channel Input
    channel_query = args.channel
    if not channel_query:
        print("\n=== Generic YouTube Channel Harvester ===")
        channel_query = input("Enter YouTube Channel Handle, ID, or URL (e.g. @WalkOffTheEarth): ").strip()
        if not channel_query:
            print("[!] No channel provided. Exiting.")
            sys.exit(0)

    # 3. Resolve Channel Details & Uploads Playlist
    print(f"\n[*] Resolving channel details for '{channel_query}'...")
    channel_meta = resolve_channel_details(api_key, channel_query)
    channel_title = channel_meta["channel_title"]
    channel_slug = slugify(channel_meta["custom_url"].lstrip("@") or channel_title)
    uploads_id = channel_meta["uploads_playlist_id"]

    print(f"[+] Channel Name:    {channel_title}")
    print(f"[+] Handle/URL:      {channel_meta['custom_url']}")
    print(f"[+] Channel ID:      {channel_meta['channel_id']}")
    print(f"[+] Total Uploads:   {channel_meta['total_video_count']}")
    print(f"[+] Uploads Playlist:{uploads_id}\n")

    # 4. Fetch all video IDs
    video_ids = fetch_all_playlist_video_ids(api_key, uploads_id)
    if not video_ids:
        print("[!] No uploads found in channel. Exiting.")
        sys.exit(0)

    # 5. Fetch Video Details
    raw_videos = fetch_video_details_in_batches(api_key, video_ids)
    df = pd.DataFrame(raw_videos)

    total_harvested = len(df)

    # 6. Filter Shorts if requested
    if not args.include_shorts and args.min_duration > 0:
        df = df[df["Duration_Seconds"] > args.min_duration].copy()
        print(f"[+] Filtered out {total_harvested - len(df)} YouTube Shorts (<= {args.min_duration}s).")

    # 7. Parse Song Titles and Artists
    parsed = df["Video_Title"].apply(lambda t: parse_generic_cover_title(t, channel_title))
    df["Song_Title"] = [p[0] for p in parsed]
    df["Artist"] = [p[1] for p in parsed]
    df["Is_Cover"] = [p[2] for p in parsed]

    if args.covers_only:
        initial_count = len(df)
        df = df[df["Is_Cover"]].copy()
        print(f"[+] Filtered to covers only: kept {len(df)} covers (excluded {initial_count - len(df)} non-covers).")

    # 8. Compute Days Since Upload and Views Per Day
    ref_date = datetime.now()
    df["Days_Since_Upload"] = df["Publish_Date"].apply(
        lambda d: max(1, (ref_date - datetime.strptime(d, "%Y-%m-%d")).days) if d else 1
    )
    df["Views_Per_Day"] = np.round(df["Views"] / df["Days_Since_Upload"], 1)

    # 9. Optional Seed CSV Merge (Spotify, Original MV, Tags)
    if args.seed_csv and os.path.exists(args.seed_csv):
        seed_df = pd.read_csv(args.seed_csv)
        print(f"[+] Merging external metadata from {args.seed_csv} ({len(seed_df)} seed rows)...")
        enrich_cols = [
            "Video_ID", "Original_Release_Year", "Macro_Genre", "Subgenre",
            "Spotify_Total_Streams", "Spotify_Daily_Streams", "Original_MV_Views",
            "Original_MV_YouTube_URL", "Kworb_Spotify_URL"
        ]
        avail_cols = [c for c in enrich_cols if c in seed_df.columns]
        if "Video_ID" in avail_cols:
            df = pd.merge(df, seed_df[avail_cols], on="Video_ID", how="left")

    # 10. Fit Log10 OLS Regression Model
    df = df.sort_values("Views", ascending=False).reset_index(drop=True)
    df, reg_stats = run_ols_log_linear(df)

    # 11. Compute Repeat Artist / Topic Scorecard
    scorecard_df = compute_repeat_artist_scorecard(df)

    # 12. Save Outputs
    output_path = args.output or f"{channel_slug}_full_channel_stats.csv"
    scorecard_path = args.scorecard_output or f"{channel_slug}_artist_scorecard.csv"

    df.to_csv(output_path, index=False)
    print(f"\n[+] Successfully saved {len(df)} videos to: {output_path}")

    if not scorecard_df.empty:
        scorecard_df.to_csv(scorecard_path, index=False)
        print(f"[+] Saved repeat artist/topic scorecard ({len(scorecard_df)} artists) to: {scorecard_path}")

    # 13. Terminal Analytics Summary
    print("\n" + "=" * 70)
    print(f"  CATALOG REGRESSION BENCHMARK: {channel_title}")
    print("=" * 70)
    print(f"  • Analyzed Videos:       {reg_stats['n']:,} uploads")
    print(f"  • Log10 Age Model R²:    {reg_stats['r_squared']:.4f}")
    print(f"  • Model Intercept:       {reg_stats['intercept']:.4f}")
    print(f"  • Daily Decay Slope:     {reg_stats['slope']:.6f}")
    print("-" * 70)

    # Display Top 5 Breakout Overperformers
    top_breakouts = df.sort_values("Age_Only_Multiplier", ascending=False).head(5)
    print("  TOP 5 BREAKOUT OVERPERFORMERS (by Age-Adjusted Multiplier):")
    for idx, row in top_breakouts.iterrows():
        song_display = row.get("Song_Title") or row.get("Video_Title")
        artist_display = f" ({row.get('Artist')})" if row.get("Artist") and row.get("Artist") != "Unknown" else ""
        print(
            f"    #{idx + 1:02d} | {row['Age_Only_Multiplier']:.2f}x | "
            f"{row['Views']:,} views (exp. {row['Age_Only_Expected_Views']:,}) | "
            f"{song_display[:45]}{artist_display}"
        )

    # Display Top Repeat Artists if available
    if not scorecard_df.empty and len(scorecard_df) > 1:
        print("-" * 70)
        print("  TOP REPEAT ARTISTS BY CATALOG VOLUME:")
        for idx, row in scorecard_df.head(5).iterrows():
            print(
                f"    • {row['Artist']}: {int(row['Total_Covers'])} covers | "
                f"{int(row['Total_Views']):,} views | "
                f"Geom Mean: {row['Geometric_Mean_Multiplier']:.2f}x | "
                f"Win Rate: {row['Win_Rate_Pct']}%"
            )

    print("=" * 70)
    print(f"\n[Tip] You can drag and drop '{output_path}' directly into the")
    print("      YouTube Studio Statistical Analyzer web dashboard to explore")
    print("      interactive scatter plots, decay curves, and diagnostic matrices!\n")


if __name__ == "__main__":
    main()

