"use strict";

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const TORRENTIO_API = "https://torrentio.strem.fun";
const PROVIDER_NAME = "Torrentio";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept": "application/json"
};

const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce"
];

// 1. DEFINE THE UI SETTINGS SCHEMA (tells the app what to render in the settings dialog)
const settings = [
  {
    key: "debridProvider",
    label: "Debrid Provider",
    type: "select",
    default: "none",
    options: [
      { label: "None", value: "none" },
      { label: "RealDebrid", value: "realdebrid" },
      { label: "Premiumize", value: "premiumize" },
      { label: "AllDebrid", value: "alldebrid" },
      { label: "DebridLink", value: "debridlink" },
      { label: "EasyDebrid", value: "easydebrid" },
      { label: "Offcloud", value: "offcloud" },
      { label: "TorBox", value: "torbox" },
      { label: "Put.io", value: "putio" }
    ]
  },
  {
    key: "debridKey",
    label: "API Key / Token",
    type: "text",
    default: "",
    placeholder: "Enter your Debrid API key"
  }
];

// Active state holder
let userSettings = {
  debridProvider: "none",
  debridKey: ""
};

/**
 * Called by the app framework whenever settings are loaded or changed by the user
 */
function onSettings(newSettings = {}) {
  if (typeof newSettings === "object" && newSettings !== null) {
    if (newSettings.debridProvider) {
      userSettings.debridProvider = String(newSettings.debridProvider).toLowerCase();
    }
    if (newSettings.debridKey) {
      userSettings.debridKey = String(newSettings.debridKey).trim();
    }
  }
}

function buildMagnet(infoHash) {
  if (!infoHash) return "";
  const tr = TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");
  return `magnet:?xt=urn:btih:${infoHash}${tr}`;
}

function getDebridPathSegment() {
  const provider = userSettings.debridProvider;
  const key = userSettings.debridKey;

  if (!provider || provider === "none" || !key) {
    return "";
  }

  return `${provider}=${key}`;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === "tv" || mediaType === "series";
  const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

  try {
    const meta = await fetch(tmdbUrl).then(r => r.json()).catch(() => null);
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id || tmdbId;
    const titleName = meta?.title || meta?.name || "Unknown Title";
    const releaseYear = meta?.release_date
      ? meta.release_date.split("-")[0]
      : (meta?.first_air_date ? meta.first_air_date.split("-")[0] : "2026");

    const debridSegment = getDebridPathSegment();
    const configPath = debridSegment ? `${debridSegment}/` : "";
    const streamType = isSeries ? `series/${imdbId}:${season || 1}:${episode || 1}` : `movie/${imdbId}`;
    const streamUrl = `${TORRENTIO_API}/${configPath}stream/${streamType}.json`;

    const data = await fetch(streamUrl, { headers: HEADERS }).then(r => r.json()).catch(() => null);
    if (!data?.streams || data.streams.length === 0) return [];

    const result = [];

    data.streams.slice(0, 15).forEach(item => {
      if (!item) return;

      const rawText = (item.title || "").replace(/\n/g, " ");
      const cleanText = rawText.toUpperCase();

      const seeders = rawText.match(/👤\s*(\d+)/)?.[1] || "0";

      let sizeStr = "Unknown Size";
      const sizeMatch = rawText.match(/([0-9.]+ ?[GM]B)/i);
      if (sizeMatch) {
        sizeStr = sizeMatch[1].toUpperCase();
      }

      let res = "1080p";
      let qualityEmoji = "💎";
      if (cleanText.includes("2160P") || cleanText.includes("4K")) {
        res = "2160p";
        qualityEmoji = "🔥";
      } else if (cleanText.includes("1080P")) {
        res = "1080p";
        qualityEmoji = "💎";
      } else if (cleanText.includes("720P")) {
        res = "720p";
        qualityEmoji = "⚡";
      } else if (cleanText.includes("480P")) {
        res = "480p";
        qualityEmoji = "📱";
      }

      let audioTag = "English";
      if (cleanText.includes("DUAL") || cleanText.includes("DUAL-AUDIO")) audioTag = "Dual-Audio";
      else if (cleanText.includes("MULTI") || cleanText.includes("MULTILANG") || cleanText.includes("MULTI-AUDIO")) audioTag = "Multi-Audio";
      else if (cleanText.includes("HINDI")) audioTag = "Hindi";

      const techTags = [];
      if (cleanText.includes("DV") || cleanText.includes("DOLBY VISION")) techTags.push("DV");
      if (cleanText.includes("HDR10+")) techTags.push("HDR10+");
      else if (cleanText.includes("HDR10")) techTags.push("HDR10");
      else if (cleanText.includes("HDR")) techTags.push("HDR");
      if (cleanText.includes("HEVC") || cleanText.includes("X265") || cleanText.includes("H265")) techTags.push("HEVC");

      techTags.push(audioTag);
      const restOfTitle = techTags.join(" • ");

      let detectedProvider = userSettings.debridProvider !== "none" ? userSettings.debridProvider.toUpperCase() : PROVIDER_NAME;
      const providerMatch = rawText.match(/\[(.*?)\]/);
      if (providerMatch && providerMatch[1]) {
        const candidate = providerMatch[1].trim();
        if (!/\d+P|HEVC|H264|WEB|BLURAY/i.test(candidate)) {
          detectedProvider = candidate;
        }
      }

      const streamLink = item.url || (item.infoHash ? buildMagnet(item.infoHash) : "");

      const line1 = isSeries ? `🎦 ${titleName} | S${season || 1} E${episode || 1}` : `🎬 ${titleName} - ${releaseYear}`;
      const line2 = `${qualityEmoji} ${res} | ${restOfTitle}`;
      const line3 = `👥 ${seeders} | 💾 ${sizeStr} | ⚙️ ${detectedProvider}`;
      const fullLayout = `${line1}\n${line2}\n${line3}`;

      result.push({
        name: `${PROVIDER_NAME} | 👤 ${seeders} | ${res.toUpperCase()}`,
        title: fullLayout,
        size: fullLayout,
        description: fullLayout,
        url: streamLink
      });
    });

    return result;
  } catch (err) {
    console.error("Global processing failure context:", err);
    return [];
  }
}

// 2. EXPORT THE SCHEMA alongside functions so the app can register the settings UI
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams, onSettings, settings };
} else {
  global.getStreams = getStreams;
  global.onSettings = onSettings;
  global.settings = settings;
}
