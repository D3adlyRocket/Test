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
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";

/* ----------------------------------------------------------------------------
 * ZERO-WIDTH SORTING & RESOLUTION HELPERS
 * ---------------------------------------------------------------------------- */

function getInvertedSortTag(val, maxBaseline = 999999) {
  const safeVal = Math.max(0, parseInt(val, 10) || 0);
  const inverted = Math.max(0, maxBaseline - safeVal);
  const binaryStr = inverted.toString(2).padStart(20, '0');
  return binaryStr.split('').map(bit => bit === '1' ? "\uFEFF" : "\u200B").join('');
}

function parseSizeToMB(sizeStr) {
  if (!sizeStr || sizeStr === "N/A" || sizeStr === "Unknown") return 0;
  const match = String(sizeStr).match(/([\d.]+)\s*(GB|MB)/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === "GB") return Math.floor(num * 1024);
  if (unit === "MB") return Math.floor(num);
  return 0;
}

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

function filenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const pathName = parsed.pathname.split("/").filter(Boolean).pop() || "";
    if (!pathName) return "";
    return decodeURIComponent(pathName.replace(/\+/g, " ")).trim();
  } catch (e) {
    return "";
  }
}

function typeFromUrl(url) {
  if (/\.m3u8(?:$|[?#])/i.test(url)) return "application/x-mpegURL";
  if (/\.mpd(?:$|[?#])/i.test(url)) return "application/dash+xml";
  if (/\.mp4(?:$|[?#])/i.test(url)) return "video/mp4";
  return "video/x-matroska";
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
 * PARSER & STREAM FORMATTER
 * ---------------------------------------------------------------------------- */

function parseStreamInfo(rawQuality, serverLabel, url, sizeStr) {
  const text = `${rawQuality || ""} ${serverLabel || ""} ${url || ""}`.replace(/р/gi, "p");

  const q = qualityFromText(text);
  const qEmoji = getResolutionEmoji(q);
  const qLine = `${qEmoji}`;

  let audioLang = "🗣️ Multi-Audio";
  if (/dual[- .]?audio/i.test(text)) audioLang = "🗣️ Dual-Audio";
  else if (/multi[- .]?audio/i.test(text)) audioLang = "🗣️ Multi-Audio";

  const sz = sizeStr || "";
  const sizeLine = sz ? `💾 ${sz}` : "";

  let ext = "MKV";
  if (/\.mp4/i.test(url)) ext = "MP4";
  else if (/\.m3u8/i.test(url)) ext = "HLS";
  else if (/\.mkv/i.test(url)) ext = "MKV";
  const formatLine = `🎞️ ${ext}`;

  let codecVal = "HEVC";
  if (/\b(?:HEVC|x265|H[.]?265)\b/i.test(text)) codecVal = "x265";
  else if (/\b(?:x264|AVC|H[.]?264)\b/i.test(text)) codecVal = "x264";
  else if (/\bAV1\b/i.test(text)) codecVal = "AV1";
  const codecLine = `⚡ ${codecVal}`;

  let audioCodec = "AAC";
  if (/\b(?:DDP?\s?5\.1|EAC3)\b/i.test(text)) audioCodec = "DDP 5.1";
  else if (/\bAtmos\b/i.test(text)) audioCodec = "Atmos";
  const audioLine = `🎧 ${audioCodec}`;

  const releaseLine = "WEB-DL";

  const hdrPart = /\bHDR\b/i.test(text) ? "🌈 HDR" : "";
  const dvPart = /\bDV\b|\bDolby[- ]?Vision\b/i.test(text) ? "✨ DV" : "";
  const subPart = /\bESub\b/i.test(text) ? "📝 ESub" : "";

  const enhancementsLine = [hdrPart, dvPart, subPart].filter(Boolean).join(" | ");

  return { q, qLine, audioLang, sizeLine, formatLine, codecLine, audioLine, releaseLine, enhancementsLine, sz };
}

function makeVidloveStream(sourceItem, index, total, mediaMeta) {
  const url = sourceItem.url;
  const serverLabel = sourceItem.serverLabel || "Vidlove";
  const rawFileName = filenameFromUrl(url) || `${serverLabel}_file`;

  const info = parseStreamInfo(sourceItem.quality, serverLabel, url, sourceItem.size);

  const qRank = qualityRank(info.q);
  const sizeInMB = parseSizeToMB(info.sz);

  const sortTag = getInvertedSortTag((qRank * 100000) + sizeInMB, 999999);

  /* --- HEADER LAYOUT --- */
  const headerLayout = `${sortTag}Vidlove | ${info.q} | [${serverLabel}${total > 1 ? ` ${index + 1}` : ""}]`;

  /* --- SUBHEADINGS LAYOUT --- */
  const line1_TitleHeader = mediaMeta.mediaType === "tv"
    ? `🎬 ${mediaMeta.title}${mediaMeta.year ? ` (${mediaMeta.year})` : ""} | S${mediaMeta.season}E${mediaMeta.episode}`
    : `🎬 ${mediaMeta.title}${mediaMeta.year ? ` (${mediaMeta.year})` : ""}`;

  const line2_SubheadingQuality = [info.qLine, info.audioLang, info.sizeLine].filter(Boolean).join(" | ");
  const line3_SubheadingTech = [info.formatLine, info.codecLine, info.audioLine].filter(Boolean).join(" | ");
  const line4_Enhancements = info.enhancementsLine;
  const line5_SourceInfo = `🔗 Vidlove | 🌐 ${serverLabel} | 📥 ${info.releaseLine}`;
  const line6_Filename = rawFileName;

  const lines = [
    line1_TitleHeader,
    line2_SubheadingQuality,
    line3_SubheadingTech,
    line4_Enhancements,
    line5_SourceInfo,
    line6_Filename
  ].filter(l => l !== "");

  const fullLayout = lines.join("\n");

  const headers = {
    Referer: "https://player.vidlove.cc/",
    "User-Agent": USER_AGENT
  };

  return {
    name: headerLayout,
    title: fullLayout,
    description: fullLayout,
    url: url,
    quality: null, // Bypasses default quality tag prefix injection
    qualityRank: qRank,
    sizeInMB: sizeInMB,
    type: sourceItem.type === "direct" ? typeFromUrl(url) : "video/x-matroska",
    headers: headers,
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: {
        request: headers
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

      const label = data.source.label || server;

      if (hasQualities) {
        return data.source.qualities
          .filter((q) => q && q.url)
          .map((q) => ({
            serverLabel: label,
            url: q.url,
            quality: q.quality || "",
            size: "",
            type: "direct"
          }));
      }

      return [
        {
          serverLabel: label,
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
      const streams = rawSources.map((sourceItem, idx) => 
        makeVidloveStream(sourceItem, idx, rawSources.length, mediaMeta)
      );

      streams.sort((a, b) => {
        if (b.qualityRank !== a.qualityRank) {
          return b.qualityRank - a.qualityRank;
        }
        return b.sizeInMB - a.sizeInMB;
      });

      return streams;
    } catch (e) {
      return [];
    }
  });
}

module.exports = { getStreams };
