"use strict";

const BASE_URL = "https://ballerinacappuccinalovestungtungtungsahur.com";
const REFERER = "https://player.vidlove.cc/";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = "307b7b8ef035c6aa336900aef4e203bd";
const MIN_QUALITY = 1080;
const DEFAULT_QUALITY = "1080p";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const PROVIDERS = [
  "moviebox",
  "ipcloud",
  "tcloud",
  "vidapi",
  "vixsrc",
  "1embed",
  "xpass",
  "vidrift",
  "lookmovie",
  "vidnest"
];

const DEFAULT_HEADERS = {
  "accept": "application/json",
  "accept-language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
  "sec-ch-ua": "\"Not;A=Brand\";v=\"8\", \"Chromium\";v=\"150\", \"Google Chrome\";v=\"150\"",
  "Referer": REFERER,
  "User-Agent": USER_AGENT
};

/* ----------------------------------------------------------------------------
 * HELPER & FORMATTING FUNCTIONS
 * ---------------------------------------------------------------------------- */

function getInvertedSortTag(val, maxBaseline = 999999) {
  const safeVal = Math.max(0, parseInt(val, 10) || 0);
  const inverted = Math.max(0, maxBaseline - safeVal);
  const binaryStr = inverted.toString(2).padStart(20, '0');
  return binaryStr.split('').map(bit => bit === '1' ? "\uFEFF" : "\u200B").join('');
}

function getResolutionEmoji(res) {
  const clean = String(res || '').toLowerCase();
  if (clean.includes("2160") || clean.includes("4k") || clean.includes("uhd")) return "🌟 4K";
  if (clean.includes("1080") || clean.includes("fhd")) return "🔥 1080p";
  if (clean.includes("720") || clean.includes("hd")) return "💎 720p";
  if (clean.includes("480") || clean.includes("sd")) return "📱 480p";
  return "📺 " + (res || "1080p");
}

function qualityRank(qualityStr) {
  if (/2160p|4k/i.test(qualityStr)) return 4;
  if (/1080p/i.test(qualityStr)) return 3;
  if (/720p/i.test(qualityStr)) return 2;
  if (/480p/i.test(qualityStr)) return 1;
  return 0;
}

const parseQuality = (quality) => {
  const match = String(quality || "").match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

const normalizeQuality = (quality) => {
  const q = String(quality || "").trim();
  return q ? q : DEFAULT_QUALITY;
};

const isQualityAcceptable = (quality) => {
  return parseQuality(normalizeQuality(quality)) >= MIN_QUALITY;
};

/* ----------------------------------------------------------------------------
 * METADATA FETCHING
 * ---------------------------------------------------------------------------- */

async function fetchTmdbMeta(tmdbId, mediaType, season = null, episode = null) {
  try {
    const endpoint = mediaType === "tv" ? "tv" : "movie";
    const res = await fetch(`${TMDB_BASE}/${endpoint}/${encodeURIComponent(tmdbId)}?api_key=${TMDB_KEY}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT }
    });
    if (!res.ok) return { title: "Unknown", year: null, episodeTitle: "" };
    
    const data = await res.json();
    const title = data.title || data.name || data.original_title || data.original_name || "Unknown";
    const dateStr = data.release_date || data.first_air_date || "";
    const year = dateStr ? parseInt(dateStr.slice(0, 4)) : null;

    let episodeTitle = "";
    if (mediaType === "tv" && season && episode) {
      try {
        const sRes = await fetch(`${TMDB_BASE}/tv/${encodeURIComponent(tmdbId)}/season/${season}?api_key=${TMDB_KEY}`, {
          headers: { Accept: "application/json", "User-Agent": USER_AGENT }
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData && Array.isArray(sData.episodes)) {
            const epNum = parseInt(episode);
            const epMatch = sData.episodes.find(e => e.episode_number === epNum);
            if (epMatch && epMatch.name) {
              episodeTitle = epMatch.name;
            }
          }
        }
      } catch (e) {}
    }

    return { title, year, episodeTitle };
  } catch (e) {
    return { title: "Unknown", year: null, episodeTitle: "" };
  }
}

/* ----------------------------------------------------------------------------
 * STREAM FORMATTER
 * ---------------------------------------------------------------------------- */

const buildEndpointUrl = (mediaType, tmdbId, provider, season, episode) => {
  const params = new URLSearchParams({ id: tmdbId, mode: "json", sources: provider, hevc: "1" });
  if (season != null) params.set("season", season);
  if (episode != null) params.set("episode", episode);
  return `${BASE_URL}/${mediaType}?${params}`;
};

const mapQualityToStream = (qObj, label, idx, mediaMeta) => {
  const q = normalizeQuality(qObj.quality);
  const qEmoji = getResolutionEmoji(q);
  const qRank = qualityRank(q);

  /* --- ZERO-WIDTH SORTING & HEADER --- */
  const sortTag = getInvertedSortTag((qRank * 100000) + (100 - idx), 999999);
  const headerLayout = `${sortTag}Vidlove • ${q} • ${label}`;

  /* --- FULL SUBHEADING LAYOUT LINES --- */
  const line1 = `🎬 ${mediaMeta.title}${mediaMeta.year ? ` (${mediaMeta.year})` : ""}`;
  
  let line2 = null;
  if (mediaMeta.mediaType === "tv" && mediaMeta.season && mediaMeta.episode) {
    line2 = `📋 S${mediaMeta.season} E${mediaMeta.episode}${mediaMeta.episodeTitle ? ` - ${mediaMeta.episodeTitle}` : ""}`;
  }

  const line3 = `${qEmoji} | 🗣️ Multi-Audio`;
  const line4 = `🎞️ MKV | ⚡ HEVC | 🎧 AAC`;
  const line5 = `🔗 Vidlove | 🌐 ${label} | 📥 WEB-DL`;

  const fullLayout = [line1, line2, line3, line4, line5].filter(Boolean).join("\n");

  return {
    name: headerLayout,
    title: fullLayout,
    size: fullLayout,           // CRITICAL FOR NUVIO MOBILE
    description: fullLayout,    // CRITICAL FOR NUVIO MOBILE
    url: qObj.url,
    quality: q,
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: {
        request: {
          Referer: REFERER,
          "User-Agent": USER_AGENT
        }
      }
    }
  };
};

/* ----------------------------------------------------------------------------
 * PROVIDER FETCHING & MAIN ENTRY
 * ---------------------------------------------------------------------------- */

async function fetchProviderStreams(provider, tmdbId, mediaType, season, episode, mediaMeta) {
  try {
    const res = await fetch(buildEndpointUrl(mediaType, tmdbId, provider, season, episode), {
      method: "GET",
      headers: DEFAULT_HEADERS
    });
    if (!res.ok) return [];

    const { source } = await res.json();
    if (!source) return [];

    const qualities = Array.isArray(source.qualities) ? source.qualities : [];
    const label = source.label ?? provider;

    if (qualities.length > 0) {
      return qualities
        .filter(q => q?.url && isQualityAcceptable(q.quality))
        .map((q, idx) => mapQualityToStream(q, label, idx, mediaMeta));
    }

    if (source.url && isQualityAcceptable(source.quality)) {
      return [mapQualityToStream({ url: source.url, quality: source.quality }, label, 0, mediaMeta)];
    }

    return [];
  } catch {
    return [];
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const typeStr = String(mediaType || "").toLowerCase().trim();
    const normalizedType = (typeStr === "series" || typeStr === "show" || typeStr === "tvshow" || typeStr === "tv") ? "tv" : "movie";

    if (normalizedType === "tv" && (season == null || episode == null)) return [];

    const mediaMeta = await fetchTmdbMeta(tmdbId, normalizedType, season, episode);
    mediaMeta.mediaType = normalizedType;
    mediaMeta.season = season;
    mediaMeta.episode = episode;

    const results = await Promise.all(
      PROVIDERS.map(provider => fetchProviderStreams(provider, tmdbId, normalizedType, season, episode, mediaMeta))
    );

    const seen = new Set();
    return results.flat().filter(s => s.url && !seen.has(s.url) && seen.add(s.url));
  } catch (e) {
    return [];
  }
}

module.exports = { getStreams };
