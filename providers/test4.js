"use strict";

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

var TMDB_URL = "https://api.themoviedb.org/3";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const BASE_URL = "https://ballerinacappuccinalovestungtungtungsahur.com";
const REFERER = "https://player.vidlove.cc/";

/* ----------------------------------------------------------------------------
 * HELPER & PARSER FUNCTIONS
 * ---------------------------------------------------------------------------- */

function qualityFromText(text) {
  const normalized = String(text || "").replace(/р/gi, "p");
  if (/\b(?:2160p|4k|uhd)\b/i.test(normalized)) return "2160p";
  const match = normalized.match(/\b(1080|720|480)p\b/i);
  return match ? `${match[1]}p` : "1080p";
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

function getInvertedSortTag(val, maxBaseline = 999999) {
  const safeVal = Math.max(0, parseInt(val, 10) || 0);
  const inverted = Math.max(0, maxBaseline - safeVal);
  const binaryStr = inverted.toString(2).padStart(20, '0');
  return binaryStr.split('').map(bit => bit === '1' ? "\uFEFF" : "\u200B").join('');
}

/* ----------------------------------------------------------------------------
 * METADATA FETCHING
 * ---------------------------------------------------------------------------- */

function fetchMediaDetails(tmdbId, mediaType, season = null, episode = null) {
  return __async(this, null, function* () {
    try {
      const endpoint = mediaType === "tv" ? "tv" : "movie";
      const response = yield fetch(
        `${TMDB_URL}/${endpoint}/${encodeURIComponent(tmdbId)}?api_key=${TMDB_API_KEY}`,
        { headers: { Accept: "application/json", "User-Agent": USER_AGENT } }
      );
      if (!response.ok) return { title: "Unknown", year: null, episodeTitle: "" };
      const data = yield response.json();
      const title = data.title || data.name || data.original_title || data.original_name || "Unknown";
      const dateStr = data.release_date || data.first_air_date || "";
      const year = Number(dateStr.slice(0, 4)) || null;

      let episodeTitle = "";
      if (mediaType === "tv" && season && episode) {
        try {
          const sResp = yield fetch(
            `${TMDB_URL}/tv/${encodeURIComponent(tmdbId)}/season/${season}?api_key=${TMDB_API_KEY}`,
            { headers: { Accept: "application/json", "User-Agent": USER_AGENT } }
          );
          if (sResp.ok) {
            const sData = yield sResp.json();
            if (sData && Array.isArray(sData.episodes)) {
              const epNum = Number(episode);
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
  });
}

/* ----------------------------------------------------------------------------
 * STREAM MAKER (NUVIO LAYOUT PARITY)
 * ---------------------------------------------------------------------------- */

function makeStream(sourceItem, index, total, mediaMeta) {
  const url = sourceItem.url;
  const serverLabel = sourceItem.serverLabel || "Vidlove";
  const rawQuality = sourceItem.quality || "";
  const fullText = `${rawQuality} ${serverLabel} ${url}`;

  const q = qualityFromText(fullText);
  const qEmoji = getResolutionEmoji(q);
  const qRank = qualityRank(q);

  /* --- NUVIO ZERO-WIDTH SORTING & HEADER --- */
  const sortTag = getInvertedSortTag((qRank * 100000) + (100 - index), 999999);
  const headerLayout = `${sortTag}Vidlove • ${q} • ${serverLabel}`;

  /* --- NUVIO FULL LAYOUT LINES --- */
  const line1_TitleHeader = mediaMeta.mediaType === "tv"
    ? `🎬 ${mediaMeta.title}${mediaMeta.year ? ` (${mediaMeta.year})` : ""} | S${mediaMeta.season}E${mediaMeta.episode}${mediaMeta.episodeTitle ? ` - ${mediaMeta.episodeTitle}` : ""}`
    : `🎬 ${mediaMeta.title}${mediaMeta.year ? ` (${mediaMeta.year})` : ""}`;

  const line2_SubheadingQuality = `${qEmoji} | 🗣️ Multi-Audio`;
  const line3_SubheadingTech = `🎞️ MKV | ⚡ HEVC | 🎧 AAC`;
  const line4_SourceInfo = `🔗 Vidlove | 🌐 ${serverLabel} | 📥 WEB-DL`;

  const fullLayout = [
    line1_TitleHeader,
    line2_SubheadingQuality,
    line3_SubheadingTech,
    line4_SourceInfo
  ].filter(Boolean).join("\n");

  const headers = {
    "Referer": REFERER,
    "User-Agent": USER_AGENT
  };

  return {
    _rank: qRank,
    stream: {
      name: headerLayout,
      title: fullLayout,
      size: fullLayout,           // CRITICAL FOR NUVIO MOBILE
      description: fullLayout,    // CRITICAL FOR NUVIO MOBILE
      url: url,
      behaviorHints: {
        notWebReady: true,
        proxyHeaders: {
          request: headers
        }
      }
    }
  };
}

/* ----------------------------------------------------------------------------
 * SERVER SOURCE EXTRACTOR
 * ---------------------------------------------------------------------------- */

function fetchServerSource(server, tmdbId, type, season, episode) {
  return __async(this, null, function* () {
    try {
      const resp = yield fetch(`${BASE_URL}/${type}?id=${tmdbId}${season ? `&season=${season}` : ""}${episode ? `&episode=${episode}` : ""}&mode=json&sources=${server}&hevc=1`, {
        headers: {
          accept: "application/json",
          "accept-language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
          priority: "u=1, i",
          "sec-ch-ua": "\"Not;A=Brand\";v=\"8\", \"Chromium\";v=\"150\", \"Google Chrome\";v=\"150\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"Windows\"",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "cross-site",
          Referer: REFERER
        },
        method: "GET"
      });

      const data = yield resp.json();

      const hasQualities = data.source != null && Array.isArray(data.source.qualities) && data.source.qualities.length > 0;
      if (data.source == null || (!data.source.url && !hasQualities)) {
        return [];
      }

      const meta = data.meta || {};
      const fallbackTitle = meta.name || meta.title || meta.original_title || meta.original_name || "";
      const label = data.source.label || server;

      if (hasQualities) {
        return data.source.qualities
          .filter((q) => q && q.url)
          .map((q) => ({
            serverLabel: label,
            fallbackTitle,
            url: q.url,
            quality: q.quality || "",
            size: "",
            type: "direct"
          }));
      }

      return [
        {
          serverLabel: label,
          fallbackTitle,
          url: data.source.url,
          quality: "",
          size: "",
          type: "direct"
        }
      ];
    } catch (error) {
      return [];
    }
  });
}

/* ----------------------------------------------------------------------------
 * MAIN ENTRY POINT
 * ---------------------------------------------------------------------------- */

function getStreams(tmdbId, type, season = null, episode = null) {
  return __async(this, null, function* () {
    const typeStr = String(type || "").toLowerCase().trim();
    const normalizedType = (typeStr === "series" || typeStr === "show" || typeStr === "tvshow" || typeStr === "tv") ? "tv" : "movie";

    if (!tmdbId) return [];

    const parsedSeason = Number(season);
    const parsedEpisode = Number(episode);

    const servers = [
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

    try {
      const [rawServerResults, tmdbMeta] = yield Promise.all([
        Promise.all(servers.map(server => fetchServerSource(server, tmdbId, normalizedType, parsedSeason, parsedEpisode))),
        fetchMediaDetails(String(tmdbId), normalizedType, parsedSeason, parsedEpisode)
      ]);

      const mediaMeta = {
        title: tmdbMeta.title,
        year: tmdbMeta.year,
        episodeTitle: tmdbMeta.episodeTitle,
        mediaType: normalizedType,
        season: parsedSeason,
        episode: parsedEpisode
      };

      const rawSources = rawServerResults.flat();
      
      const wrappedStreams = rawSources.map((sourceItem, idx) => 
        makeStream(sourceItem, idx, rawSources.length, mediaMeta)
      );

      return wrappedStreams.map(w => w.stream);
    } catch (e) {
      return [];
    }
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
