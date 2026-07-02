const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const TORRENTIO_API = "https://torrentio.strem.fun";
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

// ======================================
// SINGLE-HIT TMDB FETCHER (No Loops)
// ======================================
async function getMediaData(tmdbId, mediaType, season, episode) {
  try {
    const isTV = mediaType === "tv";
    const mainUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    const mainRes = await fetch(mainUrl, { skipSizeCheck: true });
    const mainData = await mainRes.json();
    
    const imdbId = mainData.external_ids?.imdb_id || mainData.imdb_id || null;
    const baseTitle = mainData.title || mainData.name || "Unknown Title";
    const year = mainData.release_date ? mainData.release_date.split("-")[0] : (mainData.first_air_date ? mainData.first_air_date.split("-")[0] : "");

    let episodeTitle = `Episode ${episode}`;
    if (isTV && season && episode) {
      try {
        const epUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
        const epRes = await fetch(epUrl, { skipSizeCheck: true });
        const epData = await epRes.json();
        if (epData.name) episodeTitle = epData.name;
      } catch (e) {}
    }

    return { imdbId, baseTitle, year, episodeTitle };
  } catch (e) {
    return { imdbId: null, baseTitle: "Unknown Title", year: "", episodeTitle: `Episode ${episode}` };
  }
}

// ======================================
// TORRENTIO CORE ENGINE
// ======================================
async function invokeTorrentio(mediaMeta, tmdbId, mediaType, season, episode) {
  try {
    const isTV = season != null && episode != null;
    const url = isTV 
      ? `${TORRENTIO_API}/stream/series/${mediaMeta.imdbId}:${season}:${episode}.json` 
      : `${TORRENTIO_API}/stream/movie/${mediaMeta.imdbId}.json`;

    const res = await fetch(url, { headers: HEADERS, skipSizeCheck: true });
    const json = await res.json();

    if (!json || !json.streams) return [];

    const streams = [];
    for (const stream of json.streams.slice(0, 15)) {
      try {
        const rawTitle = stream.title || "";
        const cleanTitle = rawTitle.toUpperCase();

        // 1. Extract Seeders & File Size
        const seeders = rawTitle.match(/👤\s*(\d+)/)?.[1] || "0";
        const sizeMatch = rawTitle.match(/([0-9.]+ ?[GM]B)/i);
        const fileSize = sizeMatch ? sizeMatch[1] : "Unknown Size";

        // 2. Strict Provider Filtering (Fixes Screenshot 2)
        let provider = "Torrentio";
        const providerMatch = rawTitle.match(/\[(.*?)\]/);
        if (providerMatch && providerMatch[1]) {
          const candidate = providerMatch[1].trim();
          // Reject if it just contains video specs instead of a real release provider
          if (!/\d+P|HEVC|H264|WEB|BLURAY/i.test(candidate)) {
            provider = candidate;
          }
        }
        // Fallback common scrapers
        if (provider === "Torrentio") {
          if (cleanTitle.includes("RARBG")) provider = "RARBG";
          else if (cleanTitle.includes("YTS")) provider = "YTS";
          else if (cleanTitle.includes("PIRATEBAY") || cleanTitle.includes("TPB")) provider = "ThePirateBay";
          else if (cleanTitle.includes("1337X")) provider = "1337x";
          else if (cleanTitle.includes("EZTV")) provider = "EZTV";
          else if (cleanTitle.includes("TGX")) provider = "TGX";
        }

        // 3. Resolutions & Emojis
        let quality = "1080p";
        let qualityEmoji = "💎";
        if (cleanTitle.includes("2160P") || cleanTitle.includes("4K")) { quality = "2160p"; qualityEmoji = "🔥"; }
        else if (cleanTitle.includes("1080P")) { quality = "1080p"; qualityEmoji = "💎"; }
        else if (cleanTitle.includes("720P")) { quality = "720p"; qualityEmoji = "⚡"; }
        else if (cleanTitle.includes("480P")) { quality = "480p"; qualityEmoji = "📱"; }

        // 4. Video tech details (DV, HDR10+, HEVC)
        const techTags = [];
        if (cleanTitle.includes("DV") || cleanTitle.includes("DOLBY VISION")) techTags.push("DV");
        if (cleanTitle.includes("HDR10+")) techTags.push("HDR10+");
        else if (cleanTitle.includes("HDR10")) techTags.push("HDR10");
        else if (cleanTitle.includes("HDR")) techTags.push("HDR");
        if (cleanTitle.includes("HEVC") || cleanTitle.includes("X265") || cleanTitle.includes("H265")) techTags.push("HEVC");

        // 5. Audio tracking setup (Neat and tidy inside line 2)
        let audioTag = "";
        if (cleanTitle.includes("DUAL") || cleanTitle.includes("DUAL-AUDIO")) audioTag = "Dual-Audio";
        else if (cleanTitle.includes("MULTI") || cleanTitle.includes("MULTILANG") || cleanTitle.includes("MULTI-AUDIO")) audioTag = "Multi-Audio";
        else if (cleanTitle.includes("HINDI")) audioTag = "Hindi";
        else if (cleanTitle.includes("ENGLISH") || cleanTitle.includes("ENG")) audioTag = "English";
        
        if (audioTag) techTags.push(audioTag);

        const restOfTitle = techTags.length > 0 ? techTags.join(" • ") : "SDR";

        const magnet = buildMagnet(stream.infoHash);
        if (!magnet) continue;

        // ==========================================
        // LAYOUT SPECIFICATIONS
        // ==========================================
        // Header line
        const nameHeader = `Torrentio | 👤 ${seeders} | ${quality.toUpperCase()}`;

        // Subheading Line 1
        const line1 = isTV 
          ? `🎦 ${mediaMeta.baseTitle} | S${season} E${episode} • ${mediaMeta.episodeTitle}`
          : `🎬 ${mediaMeta.baseTitle}${mediaMeta.year ? ` - ${mediaMeta.year}` : ""}`;

        // Subheading Line 2
        const line2 = `${qualityEmoji} ${quality} | ${restOfTitle}`;

        // Subheading Line 3
        const line3 = `👥 ${seeders} | 💾 ${fileSize} | ⚙️ ${provider}`;

        // Compiled subheadings flat layout
        const compiledLayout = `${line1}\n${line2}\n${line3}`;

        streams.push({
          url: magnet,
          name: nameHeader,
          title: compiledLayout,
          description: compiledLayout
        });
      } catch (e) {}
    }
    return streams;
  } catch (e) {
    return [];
  }
}

// ======================================
// ENTRYPOINT
// ======================================
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. Fetch metadata once cleanly upfront (Ensures subheadings render on mobile)
    const mediaMeta = await getMediaData(tmdbId, mediaType, season, episode);
    if (!mediaMeta.imdbId) return [];

    // 2. Fetch stream payloads
    return await invokeTorrentio(
      mediaMeta,
      tmdbId,
      mediaType,
      mediaType === "tv" ? season : null,
      mediaType === "tv" ? episode : null
    );
  } catch (e) {
    return [];
  }
}

module.exports = { getStreams };
