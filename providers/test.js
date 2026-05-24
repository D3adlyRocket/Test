// kickassanime.js
// Fixed for Nuvio module system + safer stream extraction

const BASE_URL = "https://kaa.lt";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "*/*",
  "Content-Type": "application/json",
  "x-origin": "kickass-anime.ru"
};

function extractQuality(text) {
  const u = (text || "").toLowerCase();
  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  return "Unknown";
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. TMDB lookup
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search API
    const searchResp = await fetch(`${BASE_URL}/api/fsearch`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ page: "1", query: title }),
      skipSizeCheck: true
    });

    const searchData = await searchResp.json();
    if (!searchData?.result?.length) return [];

    const match =
      searchData.result.find(r =>
        (r.title_en || r.title || "").toLowerCase().includes(title.toLowerCase())
      ) || searchData.result[0];

    if (!match) return [];

    const showSlug = match.slug || match.watch_uri;
    if (!showSlug) return [];

    const showName = showSlug.startsWith("/")
      ? showSlug
      : `/${showSlug}`;

    // 3. Episodes list
    const epsResp = await fetch(
      `${BASE_URL}/api/show${showName}/episodes?ep=1&lang=ja-JP`,
      { headers: HEADERS, skipSizeCheck: true }
    );

    const epsData = await epsResp.json();
    const episodes = epsData?.result || [];

    let target = episodes.find(e => {
      const epNum = Math.floor(parseFloat(e.episode_number || 0));
      return epNum === parseInt(episode);
    }) || episodes[0];

    if (!target) return [];

    const epNum = Math.floor(parseFloat(target.episode_number || 1));

    const episodeUrl = `${BASE_URL}/api/show${showName}/episode/ep-${epNum}-${target.slug}`;

    // 4. Get servers
    const serversResp = await fetch(episodeUrl, {
      headers: HEADERS,
      skipSizeCheck: true
    });

    const serversData = await serversResp.json();
    if (!serversData?.servers) return [];

    const streams = [];

    for (const server of serversData.servers) {
      if (!server?.src) continue;

      if (!server.name) continue;

      const name = server.name.toLowerCase();

      if (
        name.includes("vidstreaming") ||
        name.includes("catstream") ||
        name.includes("birdstream")
      ) {
        try {
          const pageResp = await fetch(server.src, {
            headers: {
              "User-Agent": HEADERS["User-Agent"],
              "Referer": BASE_URL
            },
            skipSizeCheck: true
          });

          const html = await pageResp.text();

          // 1. direct m3u8
          const m3u8 = html.match(/https?:\/\/[^\s"'<>]+\.m3u8/);
          if (m3u8) {
            streams.push({
              url: m3u8[0],
              quality: "1080p",
              title: `KickassAnime ${server.name}`,
              subtitles: []
            });
            continue;
          }

          // 2. props fallback
          const props = html.match(/props="([^"]+)"/);
          if (props) {
            try {
              const jsonStr = props[1]
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");

              const json = JSON.parse(jsonStr);

              const video =
                json?.manifest?.[1];

              if (video) {
                streams.push({
                  url: "https:" + video,
                  quality: "1080p",
                  title: `KickassAnime ${server.name}`,
                  subtitles: []
                });
              }
            } catch (_) {}
          }

        } catch (_) {}
      }
    }

    return streams;
  } catch (e) {
    console.error("[KickassAnime]", e);
    return [];
  }
}

/**
 * ✅ NUVIO EXPORT FIX (THIS WAS MISSING BEFORE)
 */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
