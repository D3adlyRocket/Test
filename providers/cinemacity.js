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
// TMDB COMPLEMENTARY METADATA HELPERS
// ======================================
async function getMediaDetails(tmdbId, mediaType, season, episode) {
  try {
    const isTV = mediaType === "tv";
    let url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    
    if (isTV && season && episode) {
      url = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
    }

    const res = await fetch(url, { skipSizeCheck: true });
    const data = await res.json();
    
    // Fallback configurations if TMDB stalls
    if (isTV && season && episode) {
      return { epTitle: data.name || `Episode ${episode}` };
    }
    
    return {
      title: data.title || data.name || "Unknown Title",
      year: data.release_date ? data.release_date.split("-")[0] : (data.first_air_date ? data.first_air_date.split("-")[0] : ""),
      imdbId: data.external_ids?.imdb_id || data.imdb_id || null
    };
  } catch (e) {
    return { title: "Unknown Title", year: "", imdbId: null, epTitle: `Episode ${episode}` };
  }
}

// ======================================
// MAIN TORRENTIO CALL WITH COMPLEX PARSING
// ======================================
async function invokeTorrentio(imdbId, tmdbId, mediaType, season, episode) {
  try {
    const isTV = season != null && episode != null;
    const url = isTV 
      ? `${TORRENTIO_API}/stream/series/${imdbId}:${season}:${episode}.json` 
      : `${TORRENTIO_API}/stream/movie/${imdbId}.json`;

    const res = await fetch(url, { headers: HEADERS, skipSizeCheck: true });
    const json = await res.json();

    if (!json || !json.streams) return [];

    // Get Clean TMDB data to prevent raw file mess in Subheading 1
    const baseDetails = await getMediaDetails(tmdbId, mediaType);
    let episodeTitle = "";
    if (isTV) {
      const epDetails = await getMediaDetails(tmdbId, "tv", season, episode);
      episodeTitle = epDetails.epTitle;
    }

    const streams = [];
    for (const stream of json.streams.slice(0, 15)) {
      try {
        const rawTitle = stream.title || "";
        const cleanTitle = rawTitle.toUpperCase();

        // 1. Core Metrics
        const seeders = rawTitle.match(/👤\s*(\d+)/)?.[1] || "0";
        const sizeMatch = rawTitle.match(/([0-9.]+ ?[GM]B)/i);
        const fileSize = sizeMatch ? sizeMatch[1] : "Unknown Size";

        // 2. Dynamic Provider Auto-Detection
        let provider = "Torrentio";
        const providerMatch = rawTitle.match(/\[(.*?)\]/);
        if (providerMatch && providerMatch[1]) {
          provider = providerMatch[1].trim();
        } else if (cleanTitle.includes("RARBG")) provider = "RARBG";
        else if (cleanTitle.includes("YTS")) provider = "YTS";
        else if (cleanTitle.includes("PIRATEBAY") || cleanTitle.includes("TPB")) provider = "ThePirateBay";
        else if (cleanTitle.includes("1337X")) provider = "1337x";

        // 3. Resolution & Dynamic Quality Emojis
        let quality = "1080p";
        let qualityEmoji = "💎";
        if (cleanTitle.includes("2160P") || cleanTitle.includes("4K")) { quality = "2160p"; qualityEmoji = "🔥"; }
        else if (cleanTitle.includes("1080P")) { quality = "1080p"; qualityEmoji = "💎"; }
        else if (cleanTitle.includes("720P")) { quality = "720p"; qualityEmoji = "⚡"; }
        else if (cleanTitle.includes("480P")) { quality = "480p"; qualityEmoji = "📱"; }

        // 4. Video Properties (DV, HDR10+, etc.)
        const techTags = [];
        if (cleanTitle.includes("DV") || cleanTitle.includes("DOLBY VISION")) techTags.push("DV");
        if (cleanTitle.includes("HDR10+")) techTags.push("HDR10+");
        else if (cleanTitle.includes("HDR10")) techTags.push("HDR10");
        else if (cleanTitle.includes("HDR")) techTags.push("HDR");
        if (cleanTitle.includes("HEVC") || cleanTitle.includes("X265")) techTags.push("HEVC");
        if (cleanTitle.includes("ATMOS")) techTags.push("Atmos");
        if (cleanTitle.includes("DDP5.1") || cleanTitle.includes("5.1")) techTags.push("5.1");
        
        const restOfTitle = techTags.length > 0 ? techTags.join(" • ") : "SDR";

        const magnet = buildMagnet(stream.infoHash);
        if (!magnet) continue;

        // ==========================================
        // STRATEGIC MOBILE LAYOUT STRINGS
        // ==========================================
        // Main Card Header
        const headerLayout = `Torrentio | 👤 ${seeders} | ${quality.toUpperCase()}`;

        // Build Conditional Line 1 layout for Movie or Show
        const line1 = isTV 
          ? `🎦 ${baseDetails.title} | S${season} E${episode} • ${episodeTitle}`
          : `🎬 ${baseDetails.title}${baseDetails.year ? ` - ${baseDetails.year}` : ""}`;

        const line2 = `${qualityEmoji} ${quality} | ${restOfTitle}`;
        const line3 = `👥 ${seeders} | 💾 ${fileSize} | ⚙️ ${provider}`;

        // Bind all 3 subheadings clearly using newlines inside the title structure
        const compiledBody = `${line1}\n${line2}\n${line3}`;

        streams.push({
          url: magnet,
          name: headerLayout,
          title: compiledBody,
          description: compiledBody
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
    const baseDetails = await getMediaDetails(tmdbId, mediaType);
    if (!baseDetails.imdbId) return [];

    return await invokeTorrentio(
      baseDetails.imdbId,
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
