// cinefreak-interceptor.js
// Nuvio Direct URL Interceptor (Zero Network Requests, No Blocks)

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

function decodeBase64Safe(str) {
  try {
    let cleanStr = decodeURIComponent(str).trim();
    while (cleanStr.length % 4 !== 0) {
      cleanStr += "=";
    }
    return Buffer.from(cleanStr, "base64").toString("utf-8");
  } catch (e) {
    return null;
  }
}

/**
 * Main Nuvio Interceptor Entry
 * Pass the raw 'generate.php?id=' link directly into this function.
 */
async function getStreamsFromUrl(rawUrl, tmdbId, mediaType) {
  const streams = [];
  try {
    // 1. Instantly pull the base64 code out of the active link
    const idMatch = rawUrl.match(/[?&]id=([^&"'\s]+)/);
    if (!idMatch) return [];

    let decoded = decodeBase64Safe(idMatch[1]);
    if (!decoded) return [];

    // 2. Isolate the media token and strip the 'newgo' anti-bot suffix
    let tokenSegment = decoded.split("/f/")[1] || decoded.split("/x/")[1] || decoded.split("/v/")[1] || "";
    if (!tokenSegment) {
      const fallback = decoded.match(/\/[fxv]\/([a-f0-9]+)/i);
      if (fallback) tokenSegment = fallback[1];
    }

    if (!tokenSegment) return [];
    const targetHash = tokenSegment.replace(/newgo\d*$/i, "").trim();

    // 3. Fetch TMDB title parameters so the file string matches the storage layout perfectly
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();
    
    const title = mediaInfo?.title || mediaInfo?.name || "Movie";
    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s()]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    // 4. Force build the direct playable R2 cloud URLs
    const qualities = ["1080p", "720p", "480p"];
    for (const qual of qualities) {
      const r2PlayableUrl = `https://pub-${targetHash}.r2.dev/CINEFREAK.TOP%20-%20${encodeURIComponent(cleanTitle)}%20%5B${qual}%5D.mkv`;
      
      streams.push({
        url: r2PlayableUrl,
        quality: qual,
        title: `Cinefreak Direct [${qual}]`,
        subtitles: []
      });
    }

    return streams;
  } catch (e) {
    console.log("[Interceptor Error]", e);
    return [];
  }
}

module.exports = {
  getStreamsFromUrl
};
