/**
 * bingr - Built from src/bingr/
 * Generated: 2026-07-30T17:55:42.533Z
 */
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

// src/bingr/index.js
var API_URL = "https://api.bingr.one/api";
var SERVERS = [
  { id: "s11", name: "Sirius", emoji: "🌟" },
  { id: "s12", name: "Quasar", emoji: "🌌" },
  { id: "s4", name: "Luna", emoji: "🌙" }
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function fetchJson(url, options) {
  return __async(this, null, function* () {
    const response = yield fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  });
}

function normalizeQuality(source, contextStr) {
  let quality = String(source.quality || source.label || "").trim();
  if (!quality || quality.toLowerCase() === "unknown" || quality.toLowerCase() === "auto") {
    if (contextStr.includes("2160") || contextStr.includes("4k") || contextStr.includes("uhd")) return "2160p";
    if (contextStr.includes("1080") || contextStr.includes("fhd")) return "1080p";
    if (contextStr.includes("720")) return "720p";
    return "HD";
  }
  return quality;
}

function normalizeSubtitles(subtitles) {
  if (!Array.isArray(subtitles))
    return [];
  return subtitles.filter((subtitle) => subtitle && subtitle.url).map((subtitle) => ({
    url: subtitle.url,
    lang: subtitle.lang || subtitle.language || "und",
    label: subtitle.label || subtitle.name || subtitle.lang || subtitle.language || "Subtitle"
  }));
}

function buildStreamLayout(server, source, details, query, type) {
  const rawContext = ((source.url || "") + " " + (source.name || "") + " " + (source.label || ""));
  const context = rawContext.toLowerCase();

  // 1. Quality & Size & Format
  const quality = normalizeQuality(source, context);
  const qIcon = (quality.includes("2160") || quality.includes("4K")) ? "🌟" : "🔥";
  
  let size = "Unknown Size";
  const sizeMatch = rawContext.match(/(\d+(?:\.\d+)?\s*[MG]B)/i);
  if (sizeMatch) {
    size = sizeMatch[1].toUpperCase();
  }

  const format = (source.url && source.url.split('?')[0].endsWith(".mp4")) ? "MP4" : "MKV";

  // 2. Language
  const isDual = /\b(dual|multi|dubbed)\b/i.test(context);
  const langTag = isDual ? "Dual-Audio" : "English 🇺🇸";
  
  // 3. Codecs
  let vCodec = "H.264";
  if (/\b(x265|h265|hevc)\b/i.test(context)) vCodec = "HEVC";
  
  let aCodec = "Stereo";
  if (/\bddp5\.1\b/i.test(context)) aCodec = "DDP5.1";
  else if (/\bdd5\.1\b|\b5\.1\b/i.test(context)) aCodec = "DD5.1";
  else if (/\baac\b/i.test(context)) aCodec = "AAC";

  if (/\batmos\b/i.test(context)) {
    if (aCodec === "Stereo") aCodec = "Atmos";
    else aCodec += " • 🔊 Atmos";
  }

  // 4. Source & Extras
  let sourceTag = "WEB-DL";
  if (/\b(bluray|bdrip)\b/i.test(context)) sourceTag = "BluRay";
  else if (/\b(webrip)\b/i.test(context)) sourceTag = "WEBRip";

  // Header
  const headerName = `Bingr | ${quality} | ${langTag}`;

  // Subheadings
  const yearPart = details.year ? ` - ${details.year}` : "";
  let line1 = `🍿 ${details.title}${yearPart}`;
  if (type === "tv" && query.season && query.episode) {
    line1 += ` | S${pad(query.season)}E${pad(query.episode)}`;
  }

  const line2 = `${qIcon} ${quality} | 💾 ${size} | 🎞️ ${format}`;
  const line3 = `⚡ ${vCodec} | 🎧 ${aCodec}`;
  const line4 = `🔗 ${server.name} ${server.emoji} | 🕸️ ${sourceTag}`;

  return {
    name: headerName,
    title: `${line1}\n${line2}\n${line3}\n${line4}`
  };
}

function fetchServer(server, mediaType, tmdbId, query, details) {
  return __async(this, null, function* () {
    try {
      const data = yield fetchJson(`${API_URL}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srv: server.id,
          t: mediaType,
          id: String(tmdbId),
          query
        })
      });
      if (!data || !Array.isArray(data.sources))
        return [];
      
      const subtitles = normalizeSubtitles(data.subtitles);
      
      return data.sources.filter((source) => source && source.url).map((source) => {
        const layout = buildStreamLayout(server, source, details, query, mediaType);
        
        return {
          name: layout.name,
          title: layout.title,
          url: source.url,
          quality: normalizeQuality(source, (source.url + " " + source.name + " " + source.label).toLowerCase()),
          type: source.type,
          headers: source.headers || {},
          subtitles: normalizeSubtitles(source.subtitles).concat(subtitles)
        };
      });
    } catch (error) {
      console.log(`[Bingr] ${server.name} unavailable: ${error.message}`);
      return [];
    }
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const normalizedType = mediaType === "series" ? "tv" : mediaType;
    if (!tmdbId || normalizedType !== "movie" && normalizedType !== "tv" || normalizedType === "tv" && (!season || !episode)) {
      return [];
    }
    try {
      const details = yield fetchJson(
        `${API_URL}/details/${normalizedType}/${tmdbId}?v=1`
      );
      if (!details || !details.title)
        return [];
      const query = {
        title: details.title,
        year: details.year ? String(details.year) : void 0
      };
      if (normalizedType === "tv") {
        query.season = Number(season);
        query.episode = Number(episode);
      }
      const results = yield Promise.all(
        SERVERS.map(
          (server) => fetchServer(server, normalizedType, tmdbId, query, details)
        )
      );
      const seen = {};
      const streams = [].concat.apply([], results);
      return streams.filter((stream) => {
        if (seen[stream.url])
          return false;
        seen[stream.url] = true;
        return true;
      });
    } catch (error) {
      console.error(`[Bingr] Error: ${error.message}`);
      return [];
    }
  });
}

module.exports = { getStreams };
