// kickassanime.js - Nuvio Compliant Anime Module

const BASE_URL = "https://kaa.lt";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "*/*",
  "Content-Type": "application/json",
  "x-origin": "kickass-anime.ru"
};

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // Step 1: Normalize and Fetch information from TMDB
    const type = mediaType === "tv" ? "tv" : "movie";
    const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // Step 2: Query API Backend Search Engine
    const searchBody = JSON.stringify({ page: "1", query: title });
    const searchResp = await fetch(`${BASE_URL}/api/fsearch`, {
      method: "POST",
      headers: HEADERS,
      body: searchBody,
      skipSizeCheck: true
    });
    const searchData = await searchResp.json();

    if (!searchData || !searchData.result || searchData.result.length === 0) return [];

    // Match cleanest option via string filtering
    const match = searchData.result.find(r =>
      (r.title_en || r.title || "").toLowerCase().includes(title.toLowerCase())
    ) || searchData.result[0];

    if (!match) return [];

    const showSlug = match.slug || match.watch_uri;
    if (!showSlug) return [];

    // Step 3: Extract Show and Episode payloads safely
    const showName = showSlug.startsWith("/") ? showSlug : `/${showSlug}`;
    const episodesUrl = `${BASE_URL}/api/show${showName}/episodes?ep=1&lang=ja-JP`;
    const epsResp = await fetch(episodesUrl, { headers: HEADERS, skipSizeCheck: true });
    const epsData = await epsResp.json();

    const episodes = epsData && epsData.result ? epsData.result : [];
    let targetEpisode = null;

    if (type === "tv" && episode) {
      targetEpisode = episodes.find(e => {
        const epNum = Math.floor(parseFloat(e.episode_number || 0));
        return epNum === parseInt(episode);
      });
    } else {
      targetEpisode = episodes[0];
    }

    if (!targetEpisode) return [];

    const epNum = Math.floor(parseFloat(targetEpisode.episode_number || 1));
    const epSlug = targetEpisode.slug;
    const episodeUrl = `${BASE_URL}/api/show${showName}/episode/ep-${epNum}-${epSlug}`;

    // Step 4: Map Server Streams
    const serversResp = await fetch(episodeUrl, { headers: HEADERS, skipSizeCheck: true });
    const serversData = await serversResp.json();

    if (!serversData || !serversData.servers) return [];

    const streams = [];

    for (const server of serversData.servers) {
      if (!server.src) continue;

      const serverName = server.name || "VidStreaming";
      if (serverName.includes("VidStreaming") || serverName.includes("CatStream") || serverName.includes("BirdStream")) {
        try {
          const serverHost = new URL(server.src).origin;
          
          // Mimic the exact cross-site web client signature verified from your network tab capture
          const serverHeaders = {
            "Origin": "https://www.kaa.lt",
            "Referer": "https://www.kaa.lt/",
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36"
          };

          const pageResp = await fetch(server.src, { headers: serverHeaders, skipSizeCheck: true });
          const pageText = await pageResp.text();

          // Regex matching parser designed for structural adaptive HLS files 
          const m3u8Regex = /(https?:\/\/[^\s"'<>]+playlist\.m3u8[^\s"'<>]*)/gi;
          let m3u8Match = pageText.match(m3u8Regex);

          if (m3u8Match && m3u8Match.length > 0) {
            // Push found variations to the stream pool (deduplicating items)
            const uniqueUrls = [...new Set(m3u8Match)];
            
            for (const streamUrl of uniqueUrls) {
              const isSubVariant = streamUrl.includes("/a/playlist.m3u8");
              
              streams.push({
                name: `KAA ${serverName}`,
                title: `KickassAnime ${serverName} (${isSubVariant ? "Direct Video" : "Master Auto"})`,
                url: streamUrl,
                quality: isSubVariant ? "1080p" : "auto",
                headers: {
                  "User-Agent": serverHeaders["User-Agent"],
                  "Origin": serverHost,
                  "Referer": serverHost + "/",
                  "Accept": "*/*"
                },
                provider: "kickassanime"
              });
            }
            continue;
          }

          // Fallback Strategy: Safe parsing framework for props structure declarations
          const propsMatch = pageText.match(/props="([^"]+)"/);
          if (propsMatch) {
            const unescaped = propsMatch[1]
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");

            const json = JSON.parse(unescaped);
            const manifests = json.manifest || {};
            
            // Loop through all keys instead of expecting hardcoded index mappings
            for (const key in manifests) {
              if (manifests[key] && typeof manifests[key] === 'string') {
                let videoUrl = manifests[key];
                if (videoUrl.startsWith("//")) videoUrl = "https:" + videoUrl;
                if (!videoUrl.startsWith("http")) videoUrl = "https://" + videoUrl;

                streams.push({
                  name: `KAA ${serverName}`,
                  title: `KickassAnime ${serverName} (HLS Track ${key})`,
                  url: videoUrl,
                  quality: "1080p",
                  headers: {
                    "User-Agent": serverHeaders["User-Agent"],
                    "Origin": serverHost,
                    "Referer": serverHost + "/"
                  },
                  provider: "kickassanime"
                });
              }
            }
          }
        } catch (e) {
          // Silent catch to skip dead servers or broken player tracks
        }
      }
    }

    return streams;
  } catch (e) {
    console.error("[KickassAnime Module Error]", e);
    return [];
  }
}

// --- Nuvio Environment Bridge Integration Layer ---
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else if (typeof global !== 'undefined') {
  global.getStreams = getStreams;
}
