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

// --- SETTINGS RESOLVER ---

function resolveSettings(extraConfig) {
  let settings = {
    debridProvider: "none",
    debridKey: "",
    language: "any",
    minQuality: "any",
    sortBy: "seeders"
  };

  try {
    let source = extraConfig;
    if (!source && typeof globalThis !== "undefined") {
      source = globalThis.SCRAPER_SETTINGS || globalThis.SETTINGS || globalThis.settings;
    }
    if (!source && typeof global !== "undefined") {
      source = global.SCRAPER_SETTINGS || global.SETTINGS || global.settings;
    }
    if (!source && typeof window !== "undefined") {
      source = window.SCRAPER_SETTINGS || window.SETTINGS || window.settings;
    }

    if (source) {
      if (source.debridProvider) settings.debridProvider = String(source.debridProvider).toLowerCase().trim();
      if (source.debridKey) settings.debridKey = String(source.debridKey).trim();
      if (source.language) settings.language = String(source.language).trim();
      if (source.minQuality) settings.minQuality = String(source.minQuality).trim();
      if (source.sortBy) settings.sortBy = String(source.sortBy).trim();
    }
  } catch (e) {
    console.error(`[${PROVIDER_NAME}] Error parsing settings:`, e);
  }

  return settings;
}

function buildMagnet(infoHash) {
  if (!infoHash) return "";
  const tr = TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");
  return `magnet:?xt=urn:btih:${infoHash}${tr}`;
}

// Extract pure numeric bytes for strict size comparisons
function parseSizeBytes(rawText, item) {
  if (typeof item?.size === "number" && item.size > 0) return Math.floor(item.size);
  if (typeof item?.bytes === "number" && item.bytes > 0) return Math.floor(item.bytes);
  
  const match = String(rawText).match(/([0-9.]+)\s*([GM]B)/i);
  if (!match) return 0;
  
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === "GB") return Math.floor(num * 1073741824);
  if (unit === "MB") return Math.floor(num * 1048576);
  return 0;
}

function getQualityRank(res) {
  const clean = String(res).toLowerCase();
  if (clean.includes("2160") || clean.includes("4k") || clean.includes("uhd")) return 4;
  if (clean.includes("1080") || clean.includes("fhd")) return 3;
  if (clean.includes("720") || clean.includes("hd")) return 2;
  if (clean.includes("480") || clean.includes("sd")) return 1;
  return 0;
}

// Pad numbers with leading zeros so string/alphanumeric sorts behave like true numeric sorts
function padDigits(num, digits = 8) {
  const val = String(Math.max(0, parseInt(num, 10) || 0));
  return val.padStart(digits, '0');
}

// --- MAIN STREAM SCRAPER ---

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null, userSettings = null) {
  return __async(this, null, function* () {
    const isSeries = mediaType === "tv" || mediaType === "series";
    const settings = resolveSettings(userSettings);
    
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

    try {
      const meta = yield fetch(tmdbUrl).then(r => r.json()).catch(() => null);
      const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id || tmdbId;
      const titleName = meta?.title || meta?.name || "Unknown Title";
      const releaseYear = meta?.release_date
        ? meta.release_date.split("-")[0]
        : (meta?.first_air_date ? meta.first_air_date.split("-")[0] : "2026");

      const streamType = isSeries ? `series/${imdbId}:${season || 1}:${episode || 1}` : `movie/${imdbId}`;
      const streamUrl = `${TORRENTCLAW_API}/stream/${streamType}.json`;

      const data = yield fetch(streamUrl, { headers: HEADERS }).then(r => r.json()).catch(() => null);
      if (!data?.streams || !Array.isArray(data.streams) || data.streams.length === 0) return [];

      let parsedStreams = [];

      data.streams.forEach(item => {
        if (!item) return;

        const rawName = item.name || "";
        const rawTitle = item.title || "";
        const rawDesc = item.description || "";
        const combinedText = `${rawName} ${rawTitle} ${rawDesc}`.replace(/\n/g, " ");
        const cleanText = combinedText.toUpperCase();

        // Exact Integer Extraction
        let seedersNum = 0;
        if (typeof item.seeders === "number") seedersNum = Math.floor(item.seeders);
        else if (typeof item.seeds === "number") seedersNum = Math.floor(item.seeds);
        else {
          const match = combinedText.match(/👤\s*(\d+)/) || 
                        combinedText.match(/👥\s*(\d+)/) || 
                        combinedText.match(/(\d+)\s*seed/i);
          if (match && match[1]) {
            seedersNum = parseInt(match[1], 10);
          }
        }
        seedersNum = Number(seedersNum) || 0;

        // File Size Bytes Calculation
        let sizeStr = "Unknown Size";
        const sizeMatch = combinedText.match(/([0-9.]+ ?[GM]B)/i);
        if (sizeMatch) {
          sizeStr = sizeMatch[1].toUpperCase();
        }
        const sizeBytes = Number(parseSizeBytes(combinedText, item)) || 0;

        // Resolution mapping
        let res = "1080p";
        let qualityEmoji = "💎";

        if (cleanText.includes("2160P") || cleanText.includes("4K") || cleanText.includes("UHD")) {
          res = "2160p";
          qualityEmoji = "🔥";
        } else if (cleanText.includes("720P") || cleanText.includes(" 720 ") || cleanText.includes("HDTV")) {
          res = "720p";
          qualityEmoji = "⚡";
        } else if (cleanText.includes("480P") || cleanText.includes("SDTV") || cleanText.includes("CAM")) {
          res = "480p";
          qualityEmoji = "📱";
        } else if (cleanText.includes("1080P") || cleanText.includes("FHD")) {
          res = "1080p";
          qualityEmoji = "💎";
        }

        const qualityRank = Number(getQualityRank(res)) || 0;

        // Minimum Quality Filter
        if (settings.minQuality && settings.minQuality !== "any") {
          const reqRank = getQualityRank(settings.minQuality);
          if (qualityRank < reqRank) return;
        }

        // Language matching
        let audioTag = "English";
        if (cleanText.includes("DUAL") || cleanText.includes("DUAL-AUDIO")) audioTag = "Dual-Audio";
        else if (cleanText.includes("MULTI") || cleanText.includes("MULTILANG") || cleanText.includes("MULTI-AUDIO")) audioTag = "Multi-Audio";
        else if (cleanText.includes("HINDI")) audioTag = "Hindi";

        let isPreferredLanguage = false;
        if (settings.language && settings.language !== "any") {
          const langCode = settings.language.substring(0, 2).toUpperCase();
          if (cleanText.includes(` ${langCode} `) || cleanText.includes(`LANGUAGE: ${langCode}`) || cleanText.includes(audioTag.toUpperCase())) {
            isPreferredLanguage = true;
          }
        }

        const techTags = [];
        if (cleanText.includes("DV") || cleanText.includes("DOLBY VISION")) techTags.push("DV");
        if (cleanText.includes("HDR10+")) techTags.push("HDR10+");
        else if (cleanText.includes("HDR10")) techTags.push("HDR10");
        else if (cleanText.includes("HDR")) techTags.push("HDR");
        if (cleanText.includes("HEVC") || cleanText.includes("X265") || cleanText.includes("H265")) techTags.push("HEVC");

        techTags.push(audioTag);
        const restOfTitle = techTags.join(" • ");

        let detectedProvider = PROVIDER_NAME;
        const providerMatch = combinedText.match(/\[(.*?)\]/);
        if (providerMatch && providerMatch[1]) {
          const candidate = providerMatch[1].trim();
          if (!/\d+P|HEVC|H264|WEB|BLURAY/i.test(candidate)) {
            detectedProvider = candidate;
          }
        }

        const streamLink = item.url || (item.infoHash ? buildMagnet(item.infoHash) : "");

        const line1 = isSeries ? `🎦 ${titleName} | S${season || 1} E${episode || 1}` : `🎬 ${titleName} - ${releaseYear}`;
        const langStar = isPreferredLanguage ? "⭐️ " : "";
        const line2 = `${langStar}${qualityEmoji} ${res} | ${restOfTitle}`;
        const line3 = `👤 ${seedersNum} | 💾 ${sizeStr} | ⚙️ ${detectedProvider}`;
        const fullLayout = `${line1}\n${line2}\n${line3}`;

        parsedStreams.push({
          seeders: seedersNum,
          sizeBytes: sizeBytes,
          qualityRank: qualityRank,
          isPreferredLanguage: isPreferredLanguage,
          data: {
            name: `${PROVIDER_NAME} | 👤 ${seedersNum} | ${res.toUpperCase()}`,
            title: fullLayout,
            size: fullLayout,
            description: fullLayout,
            url: streamLink,
            // Internal metadata fields for host app sorting
            seeders: seedersNum,
            seeds: seedersNum,
            bytes: sizeBytes,
            // Fixed-width padded strings to override string/alphanumeric UI sorting
            sortSeedersPadded: padDigits(seedersNum, 8),
            sortSizeBytesPadded: padDigits(sizeBytes, 15)
          }
        });
      });

      // Pure numerical sort
      parsedStreams.sort((a, b) => {
        if (settings.sortBy === "size") {
          return b.sizeBytes - a.sizeBytes;
        } else if (settings.sortBy === "quality") {
          if (b.qualityRank !== a.qualityRank) {
            return b.qualityRank - a.qualityRank;
          }
          return b.seeders - a.seeders;
        }
        return b.seeders - a.seeders;
      });

      return parsedStreams.map(item => item.data);
    } catch (err) {
      console.error(`[${PROVIDER_NAME}] Execution error:`, err);
      return [];
    }
  });
}

// --- UI CONFIGURATION SCHEMA ---

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
          { label: "Most Seeders", value: "seeders" },
          { label: "Quality Score", value: "quality" },
          { label: "Largest Size", value: "size" }
        ],
        default: "seeders"
      }
    ];
  });
}

module.exports = { getStreams, onSettings };
