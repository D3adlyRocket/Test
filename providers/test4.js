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

/* ----------------------------------------------------------------------------
 * METADATA FETCHING
 * ---------------------------------------------------------------------------- */

function fetchMediaDetails(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const endpoint = mediaType === "tv" ? "tv" : "movie";
      const response = yield fetch(
        `${TMDB_URL}/${endpoint}/${encodeURIComponent(tmdbId)}?api_key=${TMDB_API_KEY}`,
        { headers: { Accept: "application/json", "User-Agent": USER_AGENT } }
      );
      if (!response.ok) return { title: "Unknown", year: null };
      const data = yield response.json();
      const title = data.title || data.name || data.original_title || data.original_name || "Unknown";
      const dateStr = data.release_date || data.first_air_date || "";
      const year = Number(dateStr.slice(0, 4)) || null;
      return { title, year };
    } catch (e) {
      return { title: "Unknown", year: null };
    }
  });
}

/* ----------------------------------------------------------------------------
 * STREAM MAKER (1SHOWS PATTERN)
 * ---------------------------------------------------------------------------- */

function makeStream(sourceItem, index, total, mediaMeta) {
  const url = sourceItem.url;
  const serverLabel = sourceItem.serverLabel || "Vidlove";
  const rawQuality = sourceItem.quality || "";
  const fullText = `${rawQuality} ${serverLabel} ${url}`;

  const q = qualityFromText(fullText);
  const qEmoji = getResolutionEmoji(q);

  /* --- LEFT BADGE (NAME) --- */
  const name = `Vidlove\n${q} [${serverLabel}${total > 1 ? ` ${index + 1}` : ""}]`;

  /* --- SUBHEADINGS (TITLE) --- */
  const line1_TitleHeader = mediaMeta.mediaType === "tv"
    ? `🎬 ${mediaMeta.title}${mediaMeta.year ? ` (${mediaMeta.year})` : ""} - S${mediaMeta.season}E${mediaMeta.episode}`
    : `🎬 ${mediaMeta.title}${mediaMeta.year ? ` (${mediaMeta.year})` : ""}`;

  const line2_SubheadingQuality = `${qEmoji} | 🗣️ Multi-Audio`;
  const line3_SubheadingTech = `🎞️ MKV | ⚡ HEVC | 🎧 AAC`;
  const line4_SourceInfo = `🔗 Vidlove | 🌐 ${serverLabel} | 📥 WEB-DL`;

  const title = [
    line1_TitleHeader,
    line2_SubheadingQuality,
    line3_SubheadingTech,
    line4_SourceInfo
  ].filter(Boolean).join("\n");

  const headers = {
    "Referer": "https://player.vidlove.cc/",
    "User-Agent": USER_AGENT
  };

  return {
    _rank: qualityRank(q),
    stream: {
      name: name,
      title: title,
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
      const resp = yield fetch(`https://ballerinacappuccinalovestungtungtungsahur.com/${type}?id=${tmdbId}${season ? `&season=${season}` : ""}${episode ? `&episode=${episode}` : ""}&mode=json&sources=${server}&hevc=1`, {
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
          Referer: "https://player.vidlove.cc/"
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
        fetchMediaDetails(String(tmdbId), normalizedType)
      ]);

      const mediaMeta = {
        title: tmdbMeta.title,
        year: tmdbMeta.year,
        mediaType: normalizedType,
        season: parsedSeason,
        episode: parsedEpisode
      };

      const rawSources = rawServerResults.flat();
      
      const wrappedStreams = rawSources.map((sourceItem, idx) => 
        makeStream(sourceItem, idx, rawSources.length, mediaMeta)
      );

      // Sort streams in JavaScript array by quality rank
      wrappedStreams.sort((a, b) => b._rank - a._rank);

      // Extract raw stream objects for Stremio engine
      return wrappedStreams.map(w => w.stream);
    } catch (e) {
      return [];
    }
  });
}

module.exports = { getStreams };
