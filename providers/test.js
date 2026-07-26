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

// --- SETTINGS HELPERS ---

function getDebridSettings() {
  let provider = "none";
  let key = "";

  try {
    let settingsObj = null;
    if (typeof global !== "undefined" && global.SCRAPER_SETTINGS) {
      settingsObj = global.SCRAPER_SETTINGS;
    } else if (typeof window !== "undefined" && window.SCRAPER_SETTINGS) {
      settingsObj = window.SCRAPER_SETTINGS;
    }

    if (settingsObj) {
      if (settingsObj.debridProvider) {
        provider = String(settingsObj.debridProvider).toLowerCase().trim();
      }
      if (settingsObj.debridKey) {
        key = String(settingsObj.debridKey).trim();
      }
    }
  } catch (e) {
    console.error("[Torrentio] Error reading settings context:", e);
  }

  return { provider, key };
}

function buildMagnet(infoHash) {
  if (!infoHash) return "";
  const tr = TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");
  return `magnet:?xt=urn:btih:${infoHash}${tr}`;
}

function getDebridPathSegment() {
  const { provider, key } = getDebridSettings();

  if (!provider || provider === "none" || !key) {
    return "";
  }

  return `${provider}=${key}`;
}

// --- MAIN STREAM SCRAPER ---

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    const isSeries = mediaType === "tv" || mediaType === "series";
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

    try {
      // 1. Fetch metadata from TMDB upfront
      const meta = yield fetch(tmdbUrl).then(r => r.json()).catch(() => null);
      const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id || tmdbId;
      const titleName = meta?.title || meta?.name || "Unknown Title";
      const releaseYear = meta?.release_date
        ? meta.release_date.split("-")[0]
        : (meta?.first_air_date ? meta.first_air_date.split("-")[0] : "2026");

      // 2. Query Torrentio API endpoint with optional Debrid path segment
      const debridSegment = getDebridPathSegment();
      const configPath = debridSegment ? `${debridSegment}/` : "";
      const streamType = isSeries ? `series/${imdbId}:${season || 1}:${episode || 1}` : `movie/${imdbId}`;
      const streamUrl = `${TORRENTIO_API}/${configPath}stream/${streamType}.json`;

      const data = yield fetch(streamUrl, { headers: HEADERS }).then(r => r.json()).catch(() => null);
      if (!data?.streams || data.streams.length === 0) return [];

      const result = [];

      // 3. Loop through streams and parse details
      data.streams.slice(0, 15).forEach(item => {
        if (!item) return;

        const rawText = (item.title || "").replace(/\n/g, " ");
        const cleanText = rawText.toUpperCase();

        // Extract Seeders
        const seeders = rawText.match(/👤\s*(\d+)/)?.[1] || "0";

        // Extract File Size
        let sizeStr = "Unknown Size";
        const sizeMatch = rawText.match(/([0-9.]+ ?[GM]B)/i);
        if (sizeMatch) {
          sizeStr = sizeMatch[1].toUpperCase();
        }

        // Resolution & Custom Quality Emojis
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

        // Audio Tag Processing
        let audioTag = "English";
        if (cleanText.includes("DUAL") || cleanText.includes("DUAL-AUDIO")) audioTag = "Dual-Audio";
        else if (cleanText.includes("MULTI") || cleanText.includes("MULTILANG") || cleanText.includes("MULTI-AUDIO")) audioTag = "Multi-Audio";
        else if (cleanText.includes("HINDI")) audioTag = "Hindi";

        // Video Tech Tags
        const techTags = [];
        if (cleanText.includes("DV") || cleanText.includes("DOLBY VISION")) techTags.push("DV");
        if (cleanText.includes("HDR10+")) techTags.push("HDR10+");
        else if (cleanText.includes("HDR10")) techTags.push("HDR10");
        else if (cleanText.includes("HDR")) techTags.push("HDR");
        if (cleanText.includes("HEVC") || cleanText.includes("X265") || cleanText.includes("H265")) techTags.push("HEVC");

        techTags.push(audioTag);
        const restOfTitle = techTags.join(" • ");

        // --- RESTORED EXACT ORIGINAL PROVIDER FILTERING ---
        let detectedProvider = PROVIDER_NAME;
        const providerMatch = rawText.match(/\[(.*?)\]/);
        if (providerMatch && providerMatch[1]) {
          const candidate = providerMatch[1].trim();
          // Skip match if it leaks video tags instead of real providers
          if (!/\d+P|HEVC|H264|WEB|BLURAY/i.test(candidate)) {
            detectedProvider = candidate;
          }
        }
        if (detectedProvider === PROVIDER_NAME) {
          if (cleanText.includes("RARBG")) detectedProvider = "RARBG";
          else if (cleanText.includes("YTS")) detectedProvider = "YTS";
          else if (cleanText.includes("PIRATEBAY") || cleanText.includes("TPB")) detectedProvider = "ThePirateBay";
          else if (cleanText.includes("1337X")) detectedProvider = "1337x";
          else if (cleanText.includes("EZTV")) detectedProvider = "EZTV";
          else if (cleanText.includes("TGX")) detectedProvider = "TGX";
        }

        const streamLink = item.url || (item.infoHash ? buildMagnet(item.infoHash) : "");

        // Targeted Presentation Layout
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
      console.error("[Torrentio] Execution failure context:", err);
      return [];
    }
  });
}

// --- UI CONFIGURATION SCHEMA ---

function onSettings() {
  return __async(this, null, function* () {
    return [
      { type: "header", label: "Debrid Provider Configuration" },
      {
        type: "select",
        key: "debridProvider",
        label: "Debrid Provider",
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
        ],
        default: "none"
      },
      {
        type: "text",
        isPassword: true,
        key: "debridKey",
        label: "API Key / Token",
        placeholder: "Enter your Debrid API key",
        description: "API Key or Access Token for your selected Debrid service."
      }
    ];
  });
}

module.exports = { getStreams, onSettings };
