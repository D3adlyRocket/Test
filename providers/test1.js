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
const TORRENTCLAW_API = "https://torrentclaw.com/api/stremio";
const PROVIDER_NAME = "TorrentClaw";

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

function getScraperSettings() {
  let settings = {
    debridProvider: "none",
    debridKey: "",
    language: "any",
    minQuality: "any",
    sortBy: "any"
  };

  try {
    let settingsObj = null;
    if (typeof global !== "undefined" && global.SCRAPER_SETTINGS) {
      settingsObj = global.SCRAPER_SETTINGS;
    } else if (typeof window !== "undefined" && window.SCRAPER_SETTINGS) {
      settingsObj = window.SCRAPER_SETTINGS;
    }

    if (settingsObj) {
      if (settingsObj.debridProvider) settings.debridProvider = String(settingsObj.debridProvider).toLowerCase().trim();
      if (settingsObj.debridKey) settings.debridKey = String(settingsObj.debridKey).trim();
      if (settingsObj.language) settings.language = String(settingsObj.language).trim();
      if (settingsObj.minQuality) settings.minQuality = String(settingsObj.minQuality).trim();
      if (settingsObj.sortBy) settings.sortBy = String(settingsObj.sortBy).trim();
    }
  } catch (e) {
    console.error(`[${PROVIDER_NAME}] Error reading settings context:`, e);
  }

  return settings;
}

function buildMagnet(infoHash) {
  if (!infoHash) return "";
  const tr = TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");
  return `magnet:?xt=urn:btih:${infoHash}${tr}`;
}

function buildConfigSegment() {
  const settings = getScraperSettings();
  const configParts = [];

  // Debrid segment formatting
  if (settings.debridProvider && settings.debridProvider !== "none" && settings.debridKey) {
    configParts.push(`${settings.debridProvider}=${settings.debridKey}`);
  }

  // Language setting
  if (settings.language && settings.language !== "any") {
    configParts.push(`lang=${settings.language}`);
  }

  // Minimum Quality setting
  if (settings.minQuality && settings.minQuality !== "any") {
    configParts.push(`quality=${settings.minQuality}`);
  }

  // Sort By setting
  if (settings.sortBy && settings.sortBy !== "any") {
    configParts.push(`sort=${settings.sortBy}`);
  }

  return configParts.length > 0 ? `${configParts.join("|")}/` : "";
}

// --- MAIN STREAM SCRAPER ---

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    const isSeries = mediaType === "tv" || mediaType === "series";
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

    try {
      // 1. Fetch metadata from TMDB
      const meta = yield fetch(tmdbUrl).then(r => r.json()).catch(() => null);
      const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id || tmdbId;
      const titleName = meta?.title || meta?.name || "Unknown Title";
      const releaseYear = meta?.release_date
        ? meta.release_date.split("-")[0]
        : (meta?.first_air_date ? meta.first_air_date.split("-")[0] : "2026");

      // 2. Query TorrentClaw API endpoint
      const configPath = buildConfigSegment();
      const streamType = isSeries ? `series/${imdbId}:${season || 1}:${episode || 1}` : `movie/${imdbId}`;
      const streamUrl = `${TORRENTCLAW_API}/${configPath}stream/${streamType}.json`;

      const data = yield fetch(streamUrl, { headers: HEADERS }).then(r => r.json()).catch(() => null);
      if (!data?.streams || data.streams.length === 0) return [];

      const result = [];

      // 3. Parse stream results
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

        // Resolution & Emojis
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

        // Provider Filtering (Preserving Indexers / Release Groups)
        let detectedProvider = PROVIDER_NAME;
        const providerMatch = rawText.match(/\[(.*?)\]/);
        if (providerMatch && providerMatch[1]) {
          const candidate = providerMatch[1].trim();
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
          else if (cleanText.includes("QXR")) detectedProvider = "QxR";
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
      console.error(`[${PROVIDER_NAME}] Execution failure context:`, err);
      return [];
    }
  });
}

// --- UI CONFIGURATION SCHEMA (MATCHING SCREENSHOTS) ---

function onSettings() {
  return __async(this, null, function* () {
    return [
      { type: "header", label: "Instant play with your debrid" },
      {
        type: "select",
        key: "debridProvider",
        label: "Debrid provider",
        options: [
          { label: "None — P2P torrents only", value: "none" },
          { label: "TorBox — recommended", value: "torbox" },
          { label: "Torrin", value: "torrin" },
          { label: "AllDebrid", value: "alldebrid" },
          { label: "Premiumize", value: "premiumize" },
          { label: "Real-Debrid", value: "realdebrid" }
        ],
        default: "none"
      },
      {
        type: "text",
        isPassword: true,
        key: "debridKey",
        label: "Debrid API key",
        placeholder: "Paste your provider API key",
        description: "Free. Your key is encrypted on server — it never travels in clear."
      },
      { type: "header", label: "Basics" },
      {
        type: "select",
        key: "language",
        label: "Preferred Language",
        description: "Streams in your language appear first with ⭐️",
        options: [
          { label: "Any", value: "any" },
          { label: "🇬🇧 English", value: "en" },
          { label: "🇺🇸 English (US)", value: "en-us" },
          { label: "🇬🇧 English (UK)", value: "en-uk" },
          { label: "🇪🇸 Español", value: "es" },
          { label: "🇪🇸 Español (España)", value: "es-es" },
          { label: "🌎 Español (Latino)", value: "es-la" },
          { label: "🇫🇷 Français", value: "fr" },
          { label: "🇫🇷 Français (France)", value: "fr-fr" },
          { label: "🇨🇦 Français (Canada)", value: "fr-ca" },
          { label: "🇧🇷 Português", value: "pt" },
          { label: "🇧🇷 Português (Brasil)", value: "pt-br" },
          { label: "🇵🇹 Português (Portugal)", value: "pt-pt" },
          { label: "🇩🇪 Deutsch", value: "de" },
          { label: "🇮🇹 Italiano", value: "it" },
          { label: "🇷🇺 Русский", value: "ru" },
          { label: "🇯🇵 日本語", value: "ja" },
          { label: "🇰🇷 한국어", value: "ko" },
          { label: "🇨🇳 中文", value: "zh" },
          { label: "🇸🇦 العربية", value: "ar" },
          { label: "🇮🇳 हिन्दी", value: "hi" },
          { label: "🇳🇱 Nederlands", value: "nl" },
          { label: "🇵🇱 Polski", value: "pl" },
          { label: "🇹🇷 Türkçe", value: "tr" },
          { label: "🇸🇪 Svenska", value: "sv" }
        ],
        default: "any"
      },
      {
        type: "select",
        key: "minQuality",
        label: "Minimum Quality",
        options: [
          { label: "Any", value: "any" },
          { label: "720p+", value: "720p" },
          { label: "1080p+", value: "1080p" },
          { label: "2160p / 4K only", value: "4k" }
        ],
        default: "any"
      },
      {
        type: "select",
        key: "sortBy",
        label: "Sort By",
        options: [
          { label: "Any", value: "any" },
          { label: "Quality Score (default)", value: "quality" },
          { label: "Most Seeders", value: "seeders" },
          { label: "Largest Size", value: "size" },
          { label: "Most Recent", value: "recent" }
        ],
        default: "any"
      }
    ];
  });
}

module.exports = { getStreams, onSettings };
