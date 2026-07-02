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

function buildMagnet(infoHash) {
  if (!infoHash) return "";
  const tr = TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");
  return `magnet:?xt=urn:btih:${infoHash}${tr}`;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === "tv" || mediaType === "series";
  const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

  try {
    // 1. Fetch metadata from TMDB upfront (Once, to keep loop performance lightning-fast)
    const meta = await fetch(tmdbUrl).then(r => r.json()).catch(() => null);
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id || tmdbId;

    const titleName = meta?.title || meta?.name || "Unknown Title";
    const releaseYear = meta?.release_date ? meta.release_date.split("-")[0] : (meta?.first_air_date ? meta.first_air_date.split("-")[0] : "2026");

    // 2. Query Torrentio API endpoint
    const streamUrl = isSeries 
      ? `${TORRENTIO_API}/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
      : `${TORRENTIO_API}/stream/movie/${imdbId}.json`;

    const data = await fetch(streamUrl, { headers: HEADERS }).then(r => r.json()).catch(() => null);
    if (!data?.streams || data.streams.length === 0) return [];

    const result = [];

    // 3. Loop through streams and convert titles into your layout
    data.streams.slice(0, 15).forEach(item => {
      if (!item || !item.infoHash) return;

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
      if (cleanText.includes("2160P") || cleanText.includes("4K")) { res = "2160p"; qualityEmoji = "🔥"; }
      else if (cleanText.includes("1080P")) { res = "1080p"; qualityEmoji = "💎"; }
      else if (cleanText.includes("720P")) { res = "720p"; qualityEmoji = "⚡"; }
      else if (cleanText.includes("480P")) { res = "480p"; qualityEmoji = "📱"; }

      // Audio Tag Processing (Dual-Audio, Multi-Audio, English, etc.)
      let audioTag = "English";
      if (cleanText.includes("DUAL") || cleanText.includes("DUAL-AUDIO")) audioTag = "Dual-Audio";
      else if (cleanText.includes("MULTI") || cleanText.includes("MULTILANG") || cleanText.includes("MULTI-AUDIO")) audioTag = "Multi-Audio";
      else if (cleanText.includes("HINDI")) audioTag = "Hindi";

      // Video Video Spec Parsing (DV, HDR10+, HEVC)
      const techTags = [];
      if (cleanText.includes("DV") || cleanText.includes("DOLBY VISION")) techTags.push("DV");
      if (cleanText.includes("HDR10+")) techTags.push("HDR10+");
      else if (cleanText.includes("HDR10")) techTags.push("HDR10");
      else if (cleanText.includes("HDR")) techTags.push("HDR");
      if (cleanText.includes("HEVC") || cleanText.includes("X265") || cleanText.includes("H265")) techTags.push("HEVC");
      
      // Combine parsed audio metadata neatly alongside HDR/Codec info inside Subheading Line 2
      techTags.push(audioTag);
      const restOfTitle = techTags.join(" • ");

      // Strict Provider Filtering
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

      // Generate Magnet Link
      const magnetUrl = buildMagnet(item.infoHash);

      // ==========================================
      // TARGETED PRESENTATION LAYOUT ALIGNMENT
      // ==========================================
      // Subheading Line 1 conditional parsing
      const line1 = isSeries 
        ? `🎦 ${titleName} | S${season || 1} E${episode || 1}`
        : `🎬 ${titleName} - ${releaseYear}`;

      const line2 = `${qualityEmoji} ${res} | ${restOfTitle}`;
      const line3 = `👥 ${seeders} | 💾 ${sizeStr} | ⚙️ ${detectedProvider}`;

      const fullLayout = `${line1}\n${line2}\n${line3}`;

      result.push({
        name: `${PROVIDER_NAME} | 👤 ${seeders} | ${res.toUpperCase()}`,
        title: fullLayout,
        size: fullLayout,       // Injected specifically to force render layout on mobile devices
        description: fullLayout,
        url: magnetUrl
      });
    });

    return result;
  } catch (err) {
    console.error("Global processing failure context:", err);
    return [];
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
